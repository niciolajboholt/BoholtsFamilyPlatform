// Sprint 33 ("Siden sidst du var her" — se
// 01_Project_Documentation/Development/33_Sprint33_Siden_Sidst_Plan.md):
// serverer aktivitetsoverblikket siden brugerens sidste besøg. Cursoren i
// user_activity_cursors er bevidst IKKE sessions-baseret (se planens
// beslutning 1) — den flyttes eksplicit her: automatisk frem, hvis intet
// er sket siden sidst, og først når klienten kvitterer (POST
// .../acknowledge), hvis der reelt er noget at vise. Kalenderdelen læses
// fra calendar_activity_log, fyldt løbende af
// server/lib/calendarActivitySync.ts — ikke et live Google-opslag.

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { getMembershipForFamily } from "../lib/familyMembership";
import { logError } from "../lib/structuredLog";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };
type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const activity = new Hono<{ Bindings: Env; Variables: Variables }>();

activity.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Aktivitets-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

activity.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

async function requireFamilyMembership(c: AppContext, familyId: string): Promise<boolean> {
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);
  return membership !== null;
}

interface CursorRow {
  lastSeenAt: string;
}

interface MovedRow {
  safeTitle: string;
  oldStart: string | null;
  newStart: string | null;
}

interface CancelledRow {
  safeTitle: string;
  oldStart: string | null;
}

interface CreatedRow {
  safeTitle: string;
  newStart: string | null;
}

interface FamilyMemberRow {
  name: string;
}

export interface ActivitySummary {
  calendar: {
    moved: Array<{ title: string; oldStart: string | null; newStart: string | null }>;
    cancelled: Array<{ title: string; oldStart: string | null }>;
    created: Array<{ title: string; start: string | null }>;
  };
  tasksCompletedCount: number;
  tasksCreatedCount: number;
  shoppingAddedCount: number;
  shoppingCheckedCount: number;
  newFamilyMembers: Array<{ name: string }>;
  totalCount: number;
}

async function collectSummary(db: D1Database, familyId: string, since: string): Promise<ActivitySummary> {
  const [moved, cancelled, created, tasksCompleted, tasksCreated, shoppingAdded, shoppingChecked, newMembers] =
    await Promise.all([
      db
        .prepare(
          `SELECT safe_title AS safeTitle, old_start AS oldStart, new_start AS newStart
           FROM calendar_activity_log
           WHERE family_id = ? AND change_type = 'moved' AND detected_at > ?
           ORDER BY detected_at DESC`,
        )
        .bind(familyId, since)
        .all<MovedRow>(),
      db
        .prepare(
          `SELECT safe_title AS safeTitle, old_start AS oldStart
           FROM calendar_activity_log
           WHERE family_id = ? AND change_type = 'cancelled' AND detected_at > ?
           ORDER BY detected_at DESC`,
        )
        .bind(familyId, since)
        .all<CancelledRow>(),
      db
        .prepare(
          `SELECT safe_title AS safeTitle, new_start AS newStart
           FROM calendar_activity_log
           WHERE family_id = ? AND change_type = 'created' AND detected_at > ?
           ORDER BY detected_at DESC`,
        )
        .bind(familyId, since)
        .all<CreatedRow>(),
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM tasks WHERE family_id = ? AND done_at IS NOT NULL AND done_at > ?",
        )
        .bind(familyId, since)
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) AS count FROM tasks WHERE family_id = ? AND created_at > ?")
        .bind(familyId, since)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM shopping_list_items
           JOIN shopping_lists ON shopping_lists.id = shopping_list_items.list_id
           WHERE shopping_lists.family_id = ? AND shopping_list_items.created_at > ?`,
        )
        .bind(familyId, since)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM shopping_list_items
           JOIN shopping_lists ON shopping_lists.id = shopping_list_items.list_id
           WHERE shopping_lists.family_id = ? AND shopping_list_items.checked_at IS NOT NULL
             AND shopping_list_items.checked_at > ?`,
        )
        .bind(familyId, since)
        .first<{ count: number }>(),
      db
        .prepare("SELECT name FROM family_members WHERE family_id = ? AND created_at > ? ORDER BY created_at DESC")
        .bind(familyId, since)
        .all<FamilyMemberRow>(),
    ]);

  const tasksCompletedCount = tasksCompleted?.count ?? 0;
  const tasksCreatedCount = tasksCreated?.count ?? 0;
  const shoppingAddedCount = shoppingAdded?.count ?? 0;
  const shoppingCheckedCount = shoppingChecked?.count ?? 0;
  const newFamilyMembers = newMembers.results.map((row) => ({ name: row.name }));

  const totalCount =
    moved.results.length +
    cancelled.results.length +
    created.results.length +
    tasksCompletedCount +
    tasksCreatedCount +
    shoppingAddedCount +
    shoppingCheckedCount +
    newFamilyMembers.length;

  return {
    calendar: {
      moved: moved.results.map((row) => ({ title: row.safeTitle, oldStart: row.oldStart, newStart: row.newStart })),
      cancelled: cancelled.results.map((row) => ({ title: row.safeTitle, oldStart: row.oldStart })),
      created: created.results.map((row) => ({ title: row.safeTitle, start: row.newStart })),
    },
    tasksCompletedCount,
    tasksCreatedCount,
    shoppingAddedCount,
    shoppingCheckedCount,
    newFamilyMembers,
    totalCount,
  };
}

activity.get("/:id/activity/since-last-visit", async (c) => {
  const familyId = c.req.param("id");

  if (!(await requireFamilyMembership(c, familyId))) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const userId = c.get("user").id;
  const now = new Date().toISOString();

  const cursor = await c.env.DB.prepare(
    "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
  )
    .bind(userId, familyId)
    .first<CursorRow>();

  if (!cursor) {
    // Allerførste besøg: intet at vise endnu (der er intet "siden sidst"
    // at måle imod), men cursoren oprettes nu, så NÆSTE besøg får en reel
    // periode.
    await c.env.DB.prepare(
      "INSERT INTO user_activity_cursors (user_id, family_id, last_seen_at) VALUES (?, ?, ?)",
    )
      .bind(userId, familyId, now)
      .run();

    return c.json({ hasActivity: false, since: null, asOf: now });
  }

  const summary = await collectSummary(c.env.DB, familyId, cursor.lastSeenAt);

  if (summary.totalCount === 0) {
    // Intet at kvittere for — cursoren rykkes med det samme, ligesom hvis
    // brugeren havde set et tomt kort og lukket det.
    await c.env.DB.prepare(
      "UPDATE user_activity_cursors SET last_seen_at = ? WHERE user_id = ? AND family_id = ?",
    )
      .bind(now, userId, familyId)
      .run();

    return c.json({ hasActivity: false, since: cursor.lastSeenAt, asOf: now });
  }

  return c.json({ hasActivity: true, since: cursor.lastSeenAt, asOf: now, ...summary });
});

activity.post("/:id/activity/acknowledge", async (c) => {
  const familyId = c.req.param("id");

  if (!(await requireFamilyMembership(c, familyId))) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await c.req.json<{ asOf?: string }>().catch(() => ({}) as { asOf?: string });

  if (typeof body.asOf !== "string" || Number.isNaN(new Date(body.asOf).getTime())) {
    return c.json({ error: "Ugyldigt tidspunkt." }, 400);
  }

  const userId = c.get("user").id;

  const cursor = await c.env.DB.prepare(
    "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
  )
    .bind(userId, familyId)
    .first<CursorRow>();

  // Idempotent og kun fremadrettet (planens beslutning 10): en
  // forsinket/gentaget kvittering kan derfor ikke utilsigtet springe over
  // aktivitet, klienten reelt aldrig nåede at vise.
  if (!cursor || new Date(body.asOf) > new Date(cursor.lastSeenAt)) {
    await c.env.DB.prepare(
      `INSERT INTO user_activity_cursors (user_id, family_id, last_seen_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, family_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    )
      .bind(userId, familyId, body.asOf)
      .run();
  }

  return c.json({ ok: true });
});

export default activity;
