import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return {
    ...actual,
    sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined),
  };
});

const { sendPushNotificationToFamily } = await import("../lib/pushNotifications");
const { sendDueBirthdayReminders } = await import("./birthdayReminders");

const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);

async function seedFamilyMember(
  env: ReturnType<typeof createFakeEnv>,
  options: { id: string; familyId: string; name: string; birthday: string | null; linkedUserId?: string | null },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, linked_user_id, created_at, birthday)
     VALUES (?, ?, ?, '#000000', 0, ?, ?, ?)`,
  )
    .bind(options.id, options.familyId, options.name, options.linkedUserId ?? null, new Date().toISOString(), options.birthday)
    .run();
}

async function seedFamily(env: ReturnType<typeof createFakeEnv>, familyId: string, ownerUserId: string): Promise<void> {
  await seedUser(env.DB as never, { id: ownerUserId });
  await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Boholt", ownerUserId, new Date().toISOString())
    .run();
  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(familyId, ownerUserId, new Date().toISOString())
    .run();
}

describe("sendDueBirthdayReminders", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
    sendPushNotificationToFamilyMock.mockClear();
  });

  it("sends a reminder exactly 7 days before a member's birthday", async () => {
    await seedFamily(env, "family-1", "owner");
    await seedFamilyMember(env, { id: "member-billie", familyId: "family-1", name: "Billie", birthday: "06-22" });

    await sendDueBirthdayReminders(env, new Date("2026-06-15T04:00:00Z"));

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledTimes(1);
    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "", // intet koblet medlem at udelade
      expect.objectContaining({ body: expect.stringContaining("Billie") }),
    );
  });

  it("does not send a reminder on any other day", async () => {
    await seedFamily(env, "family-1", "owner");
    await seedFamilyMember(env, { id: "member-billie", familyId: "family-1", name: "Billie", birthday: "06-22" });

    await sendDueBirthdayReminders(env, new Date("2026-06-14T04:00:00Z"));
    await sendDueBirthdayReminders(env, new Date("2026-06-16T04:00:00Z"));

    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("excludes the birthday member's own linked account from the notification", async () => {
    await seedFamily(env, "family-1", "owner");
    await seedUser(env.DB as never, { id: "christine" });
    await seedFamilyMember(env, {
      id: "member-christine",
      familyId: "family-1",
      name: "Christine",
      birthday: "06-22",
      linkedUserId: "christine",
    });

    await sendDueBirthdayReminders(env, new Date("2026-06-15T04:00:00Z"));

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "christine",
      expect.anything(),
    );
  });

  it("skips family members without a birthday set", async () => {
    await seedFamily(env, "family-1", "owner");
    await seedFamilyMember(env, { id: "member-billie", familyId: "family-1", name: "Billie", birthday: null });

    await sendDueBirthdayReminders(env, new Date("2026-06-15T04:00:00Z"));

    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });
});
