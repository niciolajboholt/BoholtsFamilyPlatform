// Sprint 23: Tiimo-inspireret opgaveløsning — engangsopgaver og faste
// rutiner, personlig (tildelt et familiemedlem) eller familie-rettet
// (assignedMemberId null). Se 23_Sprint23_Opgaver_Plan.md.
//
// Mønster og autorisation følger shoppingLists.ts: enhver familiemedlem må
// læse/skrive.

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { generateRoutineDraft } from "../lib/aiAssistant";
import { getMembershipForFamily } from "../lib/familyMembership";
import { sendPushNotificationToFamily, sendPushNotificationToUser } from "../lib/pushNotifications";
import { checkRateLimit } from "../lib/rateLimit";
import { isTaskIcon } from "../lib/taskIcons";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };

const tasks = new Hono<{ Bindings: Env; Variables: Variables }>();

// Sprint 29: AI-forslaget havde ingen begrænsning — enhver logget bruger
// kunne kalde Workers AI-modellen ubegrænset mange gange (både et
// misbrugs- og et budget-hensyn, jf. Sprint 23's 10.000 Neurons/dag).
const aiDraftRateLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000 };

async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

tasks.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Opgave-API fejlede:", message);
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

tasks.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

interface TaskRow {
  id: string;
  familyId: string;
  name: string;
  icon: string;
  assignedMemberId: string | null;
  timeOfDay: string | null;
  isDone: number;
  routineItemId: string | null;
  taskDate: string | null;
  createdByUserId: string;
  createdAt: string;
  doneAt: string | null;
}

interface TaskRoutineRow {
  id: string;
  familyId: string;
  name: string;
  assignedMemberId: string | null;
  weekdays: string;
  createdAt: string;
}

interface TaskRoutineItemRow {
  id: string;
  routineId: string;
  name: string;
  icon: string;
  timeOfDay: string | null;
  sortOrder: number;
}

// "YYYY-MM-DD", og rundturs-tjekket fanger ugyldige datoer som "2026-02-30"
// (som Date ellers stille ville rulle om til 2. marts).
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 1 = mandag .. 7 = søndag (ISO 8601), uafhængigt af JS's Date.getUTCDay()'s
// 0 = søndag-konvention.
function isoWeekday(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function isValidWeekdaysList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) &&
    new Set(value).size === value.length
  );
}

async function listTasksForDate(
  db: D1Database,
  familyId: string,
  date: string,
): Promise<TaskRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, family_id AS familyId, name, icon, assigned_member_id AS assignedMemberId,
              time_of_day AS timeOfDay, is_done AS isDone, routine_item_id AS routineItemId,
              task_date AS taskDate, created_by_user_id AS createdByUserId,
              created_at AS createdAt, done_at AS doneAt
       FROM tasks
       WHERE family_id = ? AND task_date = ?
       ORDER BY is_done ASC, (time_of_day IS NULL) ASC, time_of_day ASC, created_at ASC`,
    )
    .bind(familyId, date)
    .all<TaskRow>();

  return results;
}

// Genererer dagens rutine-opgaver, hvis det ikke allerede er sket — kaldes
// ved hvert GET /tasks, ikke af et planlagt baggrundsjob (se
// 23_Sprint23-planen). INSERT OR IGNORE + det partielle unik-indeks på
// (routine_item_id, task_date) gør dette sikkert at kalde flere gange
// samme dag, også hvis to familiemedlemmer rammer det samtidig.
export async function materializeTasksForDate(
  db: D1Database,
  familyId: string,
  date: string,
): Promise<void> {
  const weekday = isoWeekday(date);

  const { results: routines } = await db
    .prepare(
      `SELECT id, assigned_member_id AS assignedMemberId, weekdays, created_by_user_id AS createdByUserId
       FROM task_routines WHERE family_id = ?`,
    )
    .bind(familyId)
    .all<{ id: string; assignedMemberId: string | null; weekdays: string; createdByUserId: string }>();

  const activeRoutines = routines.filter((routine) =>
    routine.weekdays.split(",").includes(String(weekday)),
  );

  const now = new Date().toISOString();

  for (const routine of activeRoutines) {
    const { results: items } = await db
      .prepare(
        "SELECT id, name, icon, time_of_day AS timeOfDay FROM task_routine_items WHERE routine_id = ?",
      )
      .bind(routine.id)
      .all<{ id: string; name: string; icon: string; timeOfDay: string | null }>();

    for (const item of items) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO tasks
             (id, family_id, name, icon, assigned_member_id, time_of_day, is_done, routine_item_id, task_date, created_by_user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          familyId,
          item.name,
          item.icon,
          routine.assignedMemberId,
          item.timeOfDay,
          item.id,
          date,
          routine.createdByUserId,
          now,
        )
        .run();
    }
  }
}

// Familie-rettede opgaver (assignedMemberId null) går til hele familien
// undtagen den, der udløste hændelsen (samme "nogen andre gjorde noget"-
// princip som indkøbsliste/kalender). Personligt tildelte opgaver går til
// det medlems egen konto, hvis medlemmet har en (børn uden login har
// linked_user_id NULL, og får derfor ingen notifikation) — også hvis
// medlemmet selv er den, der oprettede opgaven: en opgave tildelt sig selv
// er en personlig påmindelse, ikke en "familien skal vide dette"-hændelse,
// så acting-user-undtagelsen gælder bevidst ikke her.
export async function notifyForTask(
  env: Env,
  familyId: string,
  actingUserId: string,
  assignedMemberId: string | null,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!assignedMemberId) {
    await sendPushNotificationToFamily(env, familyId, actingUserId, payload);
    return;
  }

  const member = await env.DB.prepare(
    "SELECT linked_user_id AS linkedUserId FROM family_members WHERE id = ? AND family_id = ?",
  )
    .bind(assignedMemberId, familyId)
    .first<{ linkedUserId: string | null }>();

  if (member?.linkedUserId) {
    await sendPushNotificationToUser(env, member.linkedUserId, payload);
  }
}

async function assertValidMember(
  db: D1Database,
  familyId: string,
  memberId: string,
): Promise<boolean> {
  const member = await db
    .prepare("SELECT id FROM family_members WHERE id = ? AND family_id = ?")
    .bind(memberId, familyId)
    .first();

  return Boolean(member);
}

// GET /:id/tasks?date=YYYY-MM-DD
tasks.get("/:id/tasks", async (c) => {
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

tasks.post("/:id/tasks", async (c) => {
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

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = c.get("user").id;
  const assignedMemberId = body.assignedMemberId ?? null;

  await c.env.DB.prepare(
    `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, time_of_day, is_done, task_date, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  )
    .bind(id, familyId, name, body.icon, assignedMemberId, body.timeOfDay ?? null, body.date, userId, now)
    .run();

  c.executionCtx.waitUntil(
    notifyForTask(c.env, familyId, userId, assignedMemberId, {
      title: "Ny opgave",
      body: `"${name}" er tilføjet.`,
      url: "/tasks",
    }).catch((error: unknown) => {
      console.error("Kunne ikke sende opgave-push-notifikation:", error);
    }),
  );

  const items = await listTasksForDate(c.env.DB, familyId, body.date);

  return c.json({ tasks: items });
});

tasks.patch("/:id/tasks/:taskId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare(
    "SELECT id, task_date AS taskDate FROM tasks WHERE id = ? AND family_id = ?",
  )
    .bind(taskId, familyId)
    .first<{ id: string; taskDate: string | null }>();

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
  }

  const items = await listTasksForDate(c.env.DB, familyId, task.taskDate ?? "");

  return c.json({ tasks: items });
});

tasks.delete("/:id/tasks/:taskId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const taskId = c.req.param("taskId");
  const task = await c.env.DB.prepare(
    "SELECT task_date AS taskDate FROM tasks WHERE id = ? AND family_id = ?",
  )
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
tasks.post("/:id/tasks/clear-done", async (c) => {
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

tasks.get("/:id/task-routines", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const { results: routines } = await c.env.DB.prepare(
    `SELECT id, family_id AS familyId, name, assigned_member_id AS assignedMemberId, weekdays, created_at AS createdAt
     FROM task_routines WHERE family_id = ? ORDER BY created_at ASC`,
  )
    .bind(familyId)
    .all<TaskRoutineRow>();

  const routinesWithItems = await Promise.all(
    routines.map(async (routine) => {
      const { results: items } = await c.env.DB.prepare(
        `SELECT id, routine_id AS routineId, name, icon, time_of_day AS timeOfDay, sort_order AS sortOrder
         FROM task_routine_items WHERE routine_id = ? ORDER BY sort_order ASC`,
      )
        .bind(routine.id)
        .all<TaskRoutineItemRow>();

      return {
        ...routine,
        weekdays: routine.weekdays.split(",").map(Number),
        items,
      };
    }),
  );

  return c.json({ routines: routinesWithItems });
});

tasks.post("/:id/task-routines", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    name: string;
    weekdays: number[];
    assignedMemberId?: string | null;
    items: { name: string; icon: string; timeOfDay?: string | null }[];
  }>(c);

  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Rutinen skal have et navn." }, 400);
  }

  if (!isValidWeekdaysList(body.weekdays)) {
    return c.json({ error: "Vælg mindst én ugedag." }, 400);
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "Rutinen skal have mindst én opgave." }, 400);
  }

  for (const item of body.items) {
    if (!item.name?.trim()) {
      return c.json({ error: "Hver opgave i rutinen skal have et navn." }, 400);
    }

    if (!item.icon || !isTaskIcon(item.icon)) {
      return c.json({ error: "Ukendt ikon." }, 400);
    }
  }

  if (body.assignedMemberId && !(await assertValidMember(c.env.DB, familyId, body.assignedMemberId))) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  const routineId = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = c.get("user").id;
  const assignedMemberId = body.assignedMemberId ?? null;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO task_routines (id, family_id, name, assigned_member_id, weekdays, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(routineId, familyId, name, assignedMemberId, body.weekdays.join(","), userId, now),
    ...body.items.map((item, index) =>
      c.env.DB.prepare(
        `INSERT INTO task_routine_items (id, routine_id, name, icon, time_of_day, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), routineId, item.name.trim(), item.icon, item.timeOfDay ?? null, index),
    ),
  ]);

  c.executionCtx.waitUntil(
    notifyForTask(c.env, familyId, userId, assignedMemberId, {
      title: "Ny rutine",
      body: `"${name}" er oprettet.`,
      url: "/tasks",
    }).catch((error: unknown) => {
      console.error("Kunne ikke sende rutine-push-notifikation:", error);
    }),
  );

  return c.json({
    routine: {
      id: routineId,
      familyId,
      name,
      assignedMemberId,
      weekdays: body.weekdays,
      createdAt: now,
    },
  });
});

// Genererer et rutine-UDKAST fra fritekst — gemmer intet. Sprogmodeller kan
// tage fejl eller opfinde ting, så et forslag skal altid gennemgås og
// eksplicit gemmes af et menneske (POST /task-routines ovenfor), aldrig
// automatisk (se 23_Sprint23-planen, beslutning 4).
tasks.post("/:id/task-routines/generate-draft", async (c) => {
  const familyId = c.req.param("id");
  const userId = c.get("user").id;
  const membership = await getMembershipForFamily(c.env.DB, familyId, userId);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "ai-routine-draft",
    key: userId,
    ...aiDraftRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  const body = await parseJsonBody<{ description: string }>(c);
  const description = body.description?.trim();

  if (!description) {
    return c.json({ error: "Beskriv rutinen først." }, 400);
  }

  const draft = await generateRoutineDraft(c.env, description);

  if (!draft) {
    return c.json({ error: "Kunne ikke generere et forslag. Prøv at omformulere." }, 502);
  }

  return c.json({ draft });
});

tasks.patch("/:id/task-routines/:routineId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const routineId = c.req.param("routineId");
  const routine = await c.env.DB.prepare(
    "SELECT id FROM task_routines WHERE id = ? AND family_id = ?",
  )
    .bind(routineId, familyId)
    .first();

  if (!routine) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name?: string; weekdays?: number[] }>(c);

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();

    if (!trimmedName) {
      return c.json({ error: "Rutinen skal have et navn." }, 400);
    }

    await c.env.DB.prepare("UPDATE task_routines SET name = ? WHERE id = ?")
      .bind(trimmedName, routineId)
      .run();
  }

  if (body.weekdays !== undefined) {
    if (!isValidWeekdaysList(body.weekdays)) {
      return c.json({ error: "Vælg mindst én ugedag." }, 400);
    }

    await c.env.DB.prepare("UPDATE task_routines SET weekdays = ? WHERE id = ?")
      .bind(body.weekdays.join(","), routineId)
      .run();
  }

  return c.json({ ok: true });
});

tasks.delete("/:id/task-routines/:routineId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const routineId = c.req.param("routineId");
  const routine = await c.env.DB.prepare(
    "SELECT id FROM task_routines WHERE id = ? AND family_id = ?",
  )
    .bind(routineId, familyId)
    .first();

  if (!routine) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  // Løsriv allerede materialiserede opgaver fra rutinen i stedet for at
  // slette dem — historikken (fx allerede udførte opgaver) skal ikke
  // forsvinde, bare fordi selve skabelonen slettes.
  await c.env.DB.prepare(
    "UPDATE tasks SET routine_item_id = NULL WHERE routine_item_id IN (SELECT id FROM task_routine_items WHERE routine_id = ?)",
  )
    .bind(routineId)
    .run();

  await c.env.DB.prepare("DELETE FROM task_routine_items WHERE routine_id = ?").bind(routineId).run();
  await c.env.DB.prepare("DELETE FROM task_routines WHERE id = ?").bind(routineId).run();

  return c.json({ ok: true });
});

export default tasks;
