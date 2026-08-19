import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return {
    ...actual,
    sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined),
    sendPushNotificationToUser: vi.fn().mockResolvedValue(undefined),
  };
});

const { sendPushNotificationToFamily, sendPushNotificationToUser } = await import(
  "../lib/pushNotifications"
);
const { sendDueTaskReminders } = await import("./taskReminders");

const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);
const sendPushNotificationToUserMock = vi.mocked(sendPushNotificationToUser);

async function seedFamily(env: ReturnType<typeof createFakeEnv>): Promise<{
  familyId: string;
  memberId: string;
  linkedUserId: string;
}> {
  await seedUser(env.DB as never, { id: "owner" });
  await seedUser(env.DB as never, { id: "alfred" });

  const familyId = "family-1";
  const memberId = "member-alfred";

  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", "owner", new Date().toISOString())
    .run();
  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(familyId, "owner", new Date().toISOString())
    .run();
  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
  )
    .bind(familyId, "alfred", new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, linked_user_id, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(memberId, familyId, "Alfred", "#2E7D32", "alfred", new Date().toISOString())
    .run();

  return { familyId, memberId, linkedUserId: "alfred" };
}

async function seedTask(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  overrides: {
    id: string;
    name?: string;
    assignedMemberId?: string | null;
    timeOfDay: string | null;
    taskDate: string;
    isDone?: boolean;
    remindedAt?: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO tasks
       (id, family_id, name, icon, assigned_member_id, time_of_day, is_done, task_date, created_by_user_id, created_at, reminded_at)
     VALUES (?, ?, ?, 'fritid', ?, ?, ?, ?, 'owner', ?, ?)`,
  )
    .bind(
      overrides.id,
      familyId,
      overrides.name ?? "Test-opgave",
      overrides.assignedMemberId ?? null,
      overrides.timeOfDay,
      overrides.isDone ? 1 : 0,
      overrides.taskDate,
      new Date().toISOString(),
      overrides.remindedAt ?? null,
    )
    .run();
}

async function remindedAtFor(env: ReturnType<typeof createFakeEnv>, taskId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT reminded_at AS remindedAt FROM tasks WHERE id = ?")
    .bind(taskId)
    .first<{ remindedAt: string | null }>();
  return row?.remindedAt ?? null;
}

describe("sendDueTaskReminders", () => {
  beforeEach(() => {
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    sendPushNotificationToUserMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a reminder for a task whose time falls in the current 5-minute window (summer/CEST)", async () => {
    const env = createFakeEnv();
    const { familyId, linkedUserId } = await seedFamily(env);
    // 2026-07-15T12:02:00Z = 14:02 i København (CEST, UTC+2) — floor til 14:00.
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "14:00",
      taskDate: "2026-07-15",
      assignedMemberId: "member-alfred",
    });

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToUserMock).toHaveBeenCalledWith(
      env,
      linkedUserId,
      expect.objectContaining({ title: "Påmindelse" }),
    );
    expect(await remindedAtFor(env, "task-1")).not.toBeNull();
  });

  it("sends a reminder for a task whose time falls in the current window (winter/CET)", async () => {
    const env = createFakeEnv();
    const { familyId, linkedUserId } = await seedFamily(env);
    // 2026-01-15T13:02:00Z = 14:02 i København (CET, UTC+1) — floor til 14:00.
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "14:00",
      taskDate: "2026-01-15",
      assignedMemberId: "member-alfred",
    });

    await sendDueTaskReminders(env, new Date("2026-01-15T13:02:00.000Z"));

    expect(sendPushNotificationToUserMock).toHaveBeenCalledWith(
      env,
      linkedUserId,
      expect.objectContaining({ title: "Påmindelse" }),
    );
    expect(await remindedAtFor(env, "task-1")).not.toBeNull();
  });

  it("does not remind a task whose time is outside the current window", async () => {
    const env = createFakeEnv();
    const { familyId } = await seedFamily(env);
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "15:00",
      taskDate: "2026-07-15",
      assignedMemberId: "member-alfred",
    });

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToUserMock).not.toHaveBeenCalled();
    expect(await remindedAtFor(env, "task-1")).toBeNull();
  });

  it("does not remind a task that is already done", async () => {
    const env = createFakeEnv();
    const { familyId } = await seedFamily(env);
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "14:00",
      taskDate: "2026-07-15",
      assignedMemberId: "member-alfred",
      isDone: true,
    });

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToUserMock).not.toHaveBeenCalled();
  });

  it("does not remind a task that was already reminded", async () => {
    const env = createFakeEnv();
    const { familyId } = await seedFamily(env);
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "14:00",
      taskDate: "2026-07-15",
      assignedMemberId: "member-alfred",
      remindedAt: "2026-07-15T12:00:00.000Z",
    });

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToUserMock).not.toHaveBeenCalled();
  });

  it("notifies the whole family (minus nobody) for a family-wide task", async () => {
    const env = createFakeEnv();
    const { familyId } = await seedFamily(env);
    await seedTask(env, familyId, {
      id: "task-1",
      timeOfDay: "14:00",
      taskDate: "2026-07-15",
      assignedMemberId: null,
    });

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      familyId,
      "",
      expect.objectContaining({ title: "Påmindelse" }),
    );
  });

  it("materializes today's routine tasks before checking for due reminders", async () => {
    const env = createFakeEnv();
    const { familyId } = await seedFamily(env);

    // 2026-07-15 er en onsdag (ISO-ugedag 3).
    await env.DB.prepare(
      `INSERT INTO task_routines (id, family_id, name, assigned_member_id, weekdays, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind("routine-1", familyId, "Morgenrutine", "member-alfred", "3", "owner", new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO task_routine_items (id, routine_id, name, icon, time_of_day, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind("item-1", "routine-1", "Børst tænder", "fritid", "14:00", 0)
      .run();

    await sendDueTaskReminders(env, new Date("2026-07-15T12:02:00.000Z"));

    expect(sendPushNotificationToUserMock).toHaveBeenCalledWith(
      env,
      "alfred",
      expect.objectContaining({ body: expect.stringContaining("Børst tænder") }),
    );
  });
});
