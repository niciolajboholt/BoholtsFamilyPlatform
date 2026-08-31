import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

const { default: activity } = await import("./activity");

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  ownerUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Boholt", ownerUserId, now)
    .run();

  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(familyId, ownerUserId, now)
    .run();
}

async function seedCursor(
  env: ReturnType<typeof createFakeEnv>,
  userId: string,
  familyId: string,
  lastSeenAt: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO user_activity_cursors (user_id, family_id, last_seen_at) VALUES (?, ?, ?)",
  )
    .bind(userId, familyId, lastSeenAt)
    .run();
}

async function insertTask(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  ownerUserId: string,
  options: { createdAt: string; doneAt?: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO tasks (id, family_id, name, icon, is_done, created_by_user_id, created_at, done_at)
     VALUES (?, ?, 'Ryd op', 'star', ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), familyId, options.doneAt ? 1 : 0, ownerUserId, options.createdAt, options.doneAt ?? null)
    .run();
}

async function insertShoppingItem(
  env: ReturnType<typeof createFakeEnv>,
  listId: string,
  ownerUserId: string,
  options: { createdAt: string; checkedAt?: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO shopping_list_items (id, list_id, name, category, is_checked, added_by_user_id, created_at, checked_at)
     VALUES (?, ?, 'Mælk', 'Mejeri', ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), listId, options.checkedAt ? 1 : 0, ownerUserId, options.createdAt, options.checkedAt ?? null)
    .run();
}

describe("activity routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  it("rejects any request without a session cookie", async () => {
    const response = await activity.request("/family-1/activity/since-last-visit", {}, env);
    expect(response.status).toBe(401);
  });

  it("returns 404 for a family the user does not belong to", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "outsider" });

    const response = await activity.request(
      "/some-other-family/activity/since-last-visit",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("creates a cursor and reports no activity on the very first visit", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    const response = await activity.request(
      "/family-1/activity/since-last-visit",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(200);
    const body = await response.json<{ hasActivity: boolean; since: string | null; asOf: string }>();
    expect(body).toEqual({ hasActivity: false, since: null, asOf: expect.any(String) });

    const cursor = await env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
    )
      .bind(userId, "family-1")
      .first<{ lastSeenAt: string }>();
    expect(cursor?.lastSeenAt).toBe(body.asOf);
  });

  it("advances the cursor immediately when nothing happened since last visit", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);
    const since = new Date(Date.now() - 60_000).toISOString();
    await seedCursor(env, userId, "family-1", since);

    const response = await activity.request(
      "/family-1/activity/since-last-visit",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    const body = await response.json<{ hasActivity: boolean; since: string; asOf: string }>();
    expect(body.hasActivity).toBe(false);
    expect(body.since).toBe(since);

    const cursor = await env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
    )
      .bind(userId, "family-1")
      .first<{ lastSeenAt: string }>();
    expect(cursor?.lastSeenAt).toBe(body.asOf);
    expect(cursor?.lastSeenAt).not.toBe(since);
  });

  it("reports activity across categories and holds the cursor until acknowledged", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    await seedCursor(env, userId, "family-1", since);
    const afterSince = new Date(Date.now() - 30 * 60_000).toISOString();

    await insertTask(env, "family-1", userId, { createdAt: afterSince, doneAt: afterSince });
    await insertTask(env, "family-1", userId, { createdAt: afterSince });

    await env.DB.prepare("INSERT INTO shopping_lists (id, family_id, name, created_at) VALUES (?, ?, 'Indkøb', ?)")
      .bind("list-1", "family-1", afterSince)
      .run();
    await insertShoppingItem(env, "list-1", userId, { createdAt: afterSince });
    await insertShoppingItem(env, "list-1", userId, { createdAt: since, checkedAt: afterSince });

    await env.DB.prepare(
      "INSERT INTO family_members (id, family_id, name, color, created_at) VALUES (?, ?, 'Emma', '#B5722E', ?)",
    )
      .bind("member-emma", "family-1", afterSince)
      .run();

    await env.DB.prepare(
      `INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, old_start, new_start, detected_at)
       VALUES (?, 'family-1', 'moved', 'Svømning', '2026-09-01T14:00:00.000Z', '2026-09-02T16:00:00.000Z', ?)`,
    )
      .bind("log-moved", afterSince)
      .run();
    await env.DB.prepare(
      `INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, old_start, detected_at)
       VALUES (?, 'family-1', 'cancelled', 'Lægebesøg', '2026-09-01T09:00:00.000Z', ?)`,
    )
      .bind("log-cancelled", afterSince)
      .run();
    await env.DB.prepare(
      `INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, new_start, detected_at)
       VALUES (?, 'family-1', 'created', 'Fødselsdag', '2026-09-05T10:00:00.000Z', ?)`,
    )
      .bind("log-created", afterSince)
      .run();

    const response = await activity.request(
      "/family-1/activity/since-last-visit",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    const body = await response.json<{
      hasActivity: boolean;
      totalCount: number;
      tasksCompletedCount: number;
      tasksCreatedCount: number;
      shoppingAddedCount: number;
      shoppingCheckedCount: number;
      newFamilyMembers: Array<{ name: string }>;
      calendar: { moved: unknown[]; cancelled: unknown[]; created: unknown[] };
    }>();

    expect(body.hasActivity).toBe(true);
    expect(body.tasksCompletedCount).toBe(1);
    expect(body.tasksCreatedCount).toBe(2);
    expect(body.shoppingAddedCount).toBe(1);
    expect(body.shoppingCheckedCount).toBe(1);
    expect(body.newFamilyMembers).toEqual([{ name: "Emma" }]);
    expect(body.calendar.moved).toHaveLength(1);
    expect(body.calendar.cancelled).toHaveLength(1);
    expect(body.calendar.created).toHaveLength(1);
    expect(body.totalCount).toBe(9);

    const cursor = await env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
    )
      .bind(userId, "family-1")
      .first<{ lastSeenAt: string }>();
    expect(cursor?.lastSeenAt).toBe(since);
  });

  it("advances the cursor to the acknowledged asOf timestamp", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);
    const since = new Date(Date.now() - 60_000).toISOString();
    await seedCursor(env, userId, "family-1", since);
    const asOf = new Date().toISOString();

    const response = await activity.request(
      "/family-1/activity/acknowledge",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ asOf }),
      },
      env,
    );

    expect(response.status).toBe(200);

    const cursor = await env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
    )
      .bind(userId, "family-1")
      .first<{ lastSeenAt: string }>();
    expect(cursor?.lastSeenAt).toBe(asOf);
  });

  it("ignores an acknowledge for an asOf older than the current cursor", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);
    const currentCursor = new Date().toISOString();
    await seedCursor(env, userId, "family-1", currentCursor);
    const staleAsOf = new Date(Date.now() - 60 * 60_000).toISOString();

    const response = await activity.request(
      "/family-1/activity/acknowledge",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ asOf: staleAsOf }),
      },
      env,
    );

    expect(response.status).toBe(200);

    const cursor = await env.DB.prepare(
      "SELECT last_seen_at AS lastSeenAt FROM user_activity_cursors WHERE user_id = ? AND family_id = ?",
    )
      .bind(userId, "family-1")
      .first<{ lastSeenAt: string }>();
    expect(cursor?.lastSeenAt).toBe(currentCursor);
  });

  it("rejects an acknowledge without a valid asOf", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    const response = await activity.request(
      "/family-1/activity/acknowledge",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ asOf: "not-a-date" }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });
});
