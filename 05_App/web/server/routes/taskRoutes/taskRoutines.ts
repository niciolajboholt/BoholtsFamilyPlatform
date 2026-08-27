import { Hono } from "hono";

import type { Env } from "../../env";
import { generateRoutineDraft } from "../../lib/aiAssistant";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { checkRateLimit } from "../../lib/rateLimit";
import { isTaskIcon } from "../../lib/taskIcons";
import { logError } from "../../lib/structuredLog";
import {
  assertValidMember,
  isValidWeekdaysList,
  notifyForTask,
  parseJsonBody,
  type TaskRoutineItemRow,
  type TaskRoutineRow,
  type Variables,
} from "./taskQueries";

// Sprint 29: AI-forslaget havde ingen begrænsning — enhver logget bruger
// kunne kalde Workers AI-modellen ubegrænset mange gange (både et
// misbrugs- og et budget-hensyn, jf. Sprint 23's 10.000 Neurons/dag).
const aiDraftRateLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000 };

const taskRoutines = new Hono<{ Bindings: Env; Variables: Variables }>();

taskRoutines.get("/:id/task-routines", async (c) => {
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

taskRoutines.post("/:id/task-routines", async (c) => {
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
      logError("Kunne ikke sende rutine-push-notifikation", error, { familyId });
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
taskRoutines.post("/:id/task-routines/generate-draft", async (c) => {
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

taskRoutines.patch("/:id/task-routines/:routineId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const routineId = c.req.param("routineId");
  const routine = await c.env.DB.prepare("SELECT id FROM task_routines WHERE id = ? AND family_id = ?")
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

taskRoutines.delete("/:id/task-routines/:routineId", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const routineId = c.req.param("routineId");
  const routine = await c.env.DB.prepare("SELECT id FROM task_routines WHERE id = ? AND family_id = ?")
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

export default taskRoutines;
