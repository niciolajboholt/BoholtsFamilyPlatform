import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { logError } from "../../lib/structuredLog";
import { isTaskIcon } from "../../lib/taskIcons";
import {
  assertValidMember,
  isValidDateString,
  listTasksForDate,
  materializeTasksForDate,
  notifyForTask,
  parseJsonBody,
  type Variables,
} from "./taskQueries";

const tasksCrud = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /:id/tasks?date=YYYY-MM-DD
tasksCrud.get("/:id/tasks", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const date = c.req.query("date");

  if (!date || !isValidDateString(date)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  await materializeTasksForDate(c.env.DB, familyId, date);
  const items = await listTasksForDate(c.env.DB, familyId, date);

  return c.json({ tasks: items });
});

tasksCrud.post("/:id/tasks", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    name: string;
    icon: string;
    date: string;
    assignedMemberId?: string | null;
    timeOfDay?: string | null;
    rewardAmount?: number;
  }>(c);

  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Opgaven skal have et navn." }, 400);
  }

  if (!body.icon || !isTaskIcon(body.icon)) {
    return c.json({ error: "Ukendt ikon." }, 400);
  }

  if (!body.date || !isValidDateString(body.date)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  if (body.assignedMemberId && !(await assertValidMember(c.env.DB, familyId, body.assignedMemberId))) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  // Sprint 39: kun en heltalsbelønning >= 0 giver mening — en opgave uden
  // tildelt medlem kan pr. definition ikke udløse en personlig belønning
  // (se 39_Sprint39-planen, beslutning 1), så et beløb uden en modtager
  // afvises i stedet for stiltiende at blive ignoreret.
  const rewardAmount = body.rewardAmount ?? 0;

  if (!Number.isInteger(rewardAmount) || rewardAmount < 0) {
    return c.json({ error: "Ugyldigt belønningsbeløb." }, 400);
  }

  if (rewardAmount > 0 && !body.assignedMemberId) {
    return c.json({ error: "En belønning kræver et tildelt familiemedlem." }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = c.get("user").id;
  const assignedMemberId = body.assignedMemberId ?? null;

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, time_of_day, is_done, task_date, created_by_user_id, created_at, reward_amount)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  )
    .bind(id, familyId, name, body.icon, assignedMemberId, body.timeOfDay ?? null, body.date, userId, now, rewardAmount)
    .run();

  c.executionCtx.waitUntil(
    notifyForTask(c.env, familyId, userId, assignedMemberId, {
      title: "Ny opgave",
      body: `"${name}" er tilføjet.`,
      url: "/tasks",
    }).catch((error: unknown) => {
      logError("Kunne ikke sende opgave-push-notifikation", error, { familyId });
    }),
  );

  const items = await listTasksForDate(c.env.DB, familyId, body.date);

  return c.json({ tasks: items });
});

tasksCrud.patch("/:id/tasks/:taskId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare(
    `SELECT id, task_date AS taskDate, assigned_member_id AS assignedMemberId, reward_amount AS rewardAmount
     FROM tasks WHERE id = ? AND family_id = ?`,
  )
    .bind(taskId, familyId)
    .first<{ id: string; taskDate: string | null; assignedMemberId: string | null; rewardAmount: number }>();

  if (!task) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    isDone?: boolean;
    name?: string;
    icon?: string;
    timeOfDay?: string | null;
  }>(c);

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();

    if (!trimmedName) {
      return c.json({ error: "Opgaven skal have et navn." }, 400);
    }

    await c.env.DB.prepare("UPDATE tasks SET name = ? WHERE id = ?").bind(trimmedName, taskId).run();
  }

  if (body.icon !== undefined) {
    if (!isTaskIcon(body.icon)) {
      return c.json({ error: "Ukendt ikon." }, 400);
    }

    await c.env.DB.prepare("UPDATE tasks SET icon = ? WHERE id = ?").bind(body.icon, taskId).run();
  }

  if (body.timeOfDay !== undefined) {
    // reminded_at nulstilles, så et ændret tidspunkt kan udløse en ny
    // påmindelse — uden dette ville en allerede afsendt/udeblevet
    // påmindelse for det gamle tidspunkt blokere for en ny ved det nye.
    await c.env.DB.prepare("UPDATE tasks SET time_of_day = ?, reminded_at = NULL WHERE id = ?")
      .bind(body.timeOfDay, taskId)
      .run();
  }

  if (body.isDone !== undefined) {
    await c.env.DB.prepare("UPDATE tasks SET is_done = ?, done_at = ? WHERE id = ?")
      .bind(body.isDone ? 1 : 0, body.isDone ? new Date().toISOString() : null, taskId)
      .run();

    // Sprint 39: bogfør (eller fortryd) belønningen sammen med selve
    // fuldførelsen — ikke et separat skridt. INSERT OR IGNORE + det
    // partielle unik-indeks på task_id forhindrer, at et gentaget
    // fuldført-klik (eller to samtidige PATCH-kald) bogfører beløbet
    // flere gange; DELETE ved fortryd forhindrer at gentagen
    // afkrydsning/fortryd kan "høste" belønningen mere end én gang.
    if (task.assignedMemberId && task.rewardAmount > 0) {
      if (body.isDone) {
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO allowance_ledger (id, family_id, family_member_id, amount, task_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(crypto.randomUUID(), familyId, task.assignedMemberId, task.rewardAmount, taskId, new Date().toISOString())
          .run();
      } else {
        await c.env.DB.prepare("DELETE FROM allowance_ledger WHERE task_id = ?").bind(taskId).run();
      }
    }
  }

  const items = await listTasksForDate(c.env.DB, familyId, task.taskDate ?? "");

  return c.json({ tasks: items });
});

tasksCrud.delete("/:id/tasks/:taskId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare("SELECT task_date AS taskDate FROM tasks WHERE id = ? AND family_id = ?")
    .bind(taskId, familyId)
    .first<{ taskDate: string | null }>();

  if (!task) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId).run();

  const items = await listTasksForDate(c.env.DB, familyId, task.taskDate ?? "");

  return c.json({ tasks: items });
});

// Fjerner alle udførte opgaver for én bestemt dato ("Ryd udførte").
tasksCrud.post("/:id/tasks/clear-done", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const date = c.req.query("date");

  if (!date || !isValidDateString(date)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  await c.env.DB.prepare("DELETE FROM tasks WHERE family_id = ? AND task_date = ? AND is_done = 1")
    .bind(familyId, date)
    .run();

  const items = await listTasksForDate(c.env.DB, familyId, date);

  return c.json({ tasks: items });
});

export default tasksCrud;
