// Sprint 53 (se 53_Sprint53_Barn_Pinkode_Adgang_Plan.md): børneadgang på en
// helt ny, ikke-logget-ind enhed. To dele:
// - /access/:token og /access/:token/verify er OFFENTLIGE (intet login) —
//   samme princip som routes/publicCalendar.ts's delelink.
// - Resten kræver en gyldig child_session-cookie (lib/childSession.ts),
//   ikke den almindelige users/sessions-model.
// Ingen af disse ruter må nogensinde afsløre andre medlemmers data — hver
// handling tjekker eksplicit, at målet tilhører DEN session, der spørger.

import { Hono } from "hono";

import type { Env } from "../env";
import {
  createChildSession,
  destroyChildSession,
  getChildSessionMember,
  type ChildSessionMember,
} from "../lib/childSession";
import { checkRateLimit } from "../lib/rateLimit";
import { isValidPinFormat, verifyPin } from "../lib/pinHashing";
import { logError } from "../lib/structuredLog";
import { setTaskDone } from "../lib/taskCompletion";
import {
  isValidDateString,
  listTasksForDate,
  materializeTasksForDate,
  parseJsonBody,
} from "./taskRoutes/taskQueries";

type Variables = { childMember: ChildSessionMember };

const childAccess = new Hono<{ Bindings: Env; Variables: Variables }>();

childAccess.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Børneadgang-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

interface TokenMemberRow {
  id: string;
  familyId: string;
  name: string;
  color: string;
  pinHash: string | null;
}

async function findMemberByToken(db: D1Database, token: string): Promise<TokenMemberRow | null> {
  const row = await db
    .prepare(
      `SELECT family_members.id AS id, family_members.family_id AS familyId,
              family_members.name AS name, family_members.color AS color,
              family_members.pin_hash AS pinHash
       FROM family_members
       JOIN families ON families.id = family_members.family_id
       WHERE family_members.child_access_token = ? AND families.deleted_at IS NULL`,
    )
    .bind(token)
    .first<TokenMemberRow>();

  return row ?? null;
}

// Viser barnets navn/farve UDEN at kræve PIN endnu, så enheden kan vise
// "Hej, Frida!" før kode-indtastning.
childAccess.get("/access/:token", async (c) => {
  const member = await findMemberByToken(c.env.DB, c.req.param("token"));

  if (!member) {
    return c.json({ error: "Linket er ugyldigt eller udløbet." }, 404);
  }

  return c.json({ name: member.name, color: member.color });
});

const verifyPinRateLimit = { maxAttempts: 6, windowMs: 15 * 60 * 1000 };

childAccess.post("/access/:token/verify", async (c) => {
  const token = c.req.param("token");
  const member = await findMemberByToken(c.env.DB, token);

  if (!member) {
    return c.json({ error: "Linket er ugyldigt eller udløbet." }, 404);
  }

  // Nøglet på TOKEN, ikke medlems-id — et gættet/lækket token skal ikke
  // kunne omgå begrænsningen ved at blive prøvet som "et nyt forsøg".
  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "child-pin-verify",
    key: token,
    ...verifyPinRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  if (!member.pinHash) {
    return c.json({ error: "Der er ikke sat en kode endnu. Spørg en voksen." }, 400);
  }

  const body = await parseJsonBody<{ pin: string }>(c);
  const pin = body.pin ?? "";

  if (!isValidPinFormat(pin) || !(await verifyPin(pin, member.pinHash))) {
    return c.json({ error: "Forkert kode. Prøv igen." }, 401);
  }

  await createChildSession(c, member.id);

  return c.json({ ok: true, name: member.name, color: member.color });
});

// Alt herunder kræver en gyldig child_session-cookie.
childAccess.use("*", async (c, next) => {
  const member = await getChildSessionMember(c);

  if (!member) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("childMember", member);
  await next();
});

childAccess.get("/me", (c) => c.json({ member: c.get("childMember") }));

childAccess.post("/logout", async (c) => {
  await destroyChildSession(c);
  return c.json({ ok: true });
});

// GET /today?date=YYYY-MM-DD — kun DENNE barns egne opgaver den dato,
// aldrig andre medlemmers eller familie-rettede opgaver.
childAccess.get("/today", async (c) => {
  const member = c.get("childMember");
  const date = c.req.query("date") ?? "";

  if (!isValidDateString(date)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  await materializeTasksForDate(c.env.DB, member.familyId, date);
  const tasks = await listTasksForDate(c.env.DB, member.familyId, date);

  return c.json({ tasks: tasks.filter((task) => task.assignedMemberId === member.id) });
});

// POST /tasks/:taskId/done — 404 (ikke 403) hvis opgaven ikke er barnets
// egen, samme "afslør ikke eksistensen"-princip som resten af appen.
childAccess.post("/tasks/:taskId/done", async (c) => {
  const member = c.get("childMember");
  const taskId = c.req.param("taskId");

  const task = await c.env.DB.prepare(
    `SELECT id, family_id AS familyId, task_date AS taskDate,
            assigned_member_id AS assignedMemberId, reward_amount AS rewardAmount
     FROM tasks WHERE id = ? AND family_id = ?`,
  )
    .bind(taskId, member.familyId)
    .first<{
      id: string;
      familyId: string;
      taskDate: string | null;
      assignedMemberId: string | null;
      rewardAmount: number;
    }>();

  if (!task || task.assignedMemberId !== member.id) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ isDone: boolean }>(c);

  if (body.isDone === undefined) {
    return c.json({ error: "isDone mangler." }, 400);
  }

  await setTaskDone(c.env.DB, task, body.isDone);

  const tasks = await listTasksForDate(c.env.DB, member.familyId, task.taskDate ?? "");

  return c.json({ tasks: tasks.filter((t) => t.assignedMemberId === member.id) });
});

export default childAccess;
