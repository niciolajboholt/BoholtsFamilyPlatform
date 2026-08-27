import type { Context } from "hono";

import type { Env } from "../../env";
import { sendPushNotificationToFamily, sendPushNotificationToUser } from "../../lib/pushNotifications";
import type { SessionUser } from "../../lib/session";

export type Variables = { user: SessionUser };

export interface TaskRow {
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

export interface TaskRoutineRow {
  id: string;
  familyId: string;
  name: string;
  assignedMemberId: string | null;
  weekdays: string;
  createdAt: string;
}

export interface TaskRoutineItemRow {
  id: string;
  routineId: string;
  name: string;
  icon: string;
  timeOfDay: string | null;
  sortOrder: number;
}

export async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

// "YYYY-MM-DD", og rundturs-tjekket fanger ugyldige datoer som "2026-02-30"
// (som Date ellers stille ville rulle om til 2. marts).
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 1 = mandag .. 7 = søndag (ISO 8601), uafhængigt af JS's Date.getUTCDay()'s
// 0 = søndag-konvention.
export function isoWeekday(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function isValidWeekdaysList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) &&
    new Set(value).size === value.length
  );
}

export async function listTasksForDate(db: D1Database, familyId: string, date: string): Promise<TaskRow[]> {
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

export async function assertValidMember(
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
