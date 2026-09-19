import { beforeEach, describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  AccountOwnsFamiliesError,
  cancelAccountDeletion,
  cancelFamilyDeletion,
  DeletionAlreadyRequestedError,
  DELETION_RETENTION_DAYS,
  InvalidDeletionConfirmationError,
  isReauthFresh,
  previewAccountDeletion,
  previewFamilyDeletion,
  purgeExpiredDeletions,
  requestAccountDeletion,
  requestFamilyDeletion,
} from "./accountDeletion";
import { createFakeEnv } from "../testing/fakeEnv";
import { createFakeD1, seedUser, type FakeD1 } from "../testing/fakeD1";

async function seedFamily(
  db: FakeD1,
  familyId: string,
  ownerUserId: string,
  memberUserIds: string[] = [],
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Testfamilien", ownerUserId, now)
    .run();

  await db
    .prepare("INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)")
    .bind(familyId, ownerUserId, now)
    .run();

  for (const userId of memberUserIds) {
    await db
      .prepare(
        "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
      )
      .bind(familyId, userId, now)
      .run();
  }
}

async function seedFamilyMember(
  db: FakeD1,
  familyId: string,
  memberId: string,
  linkedUserId: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, linked_user_id, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(memberId, familyId, "Testmedlem", "#ffffff", linkedUserId, new Date().toISOString())
    .run();
}

// Sår de fleste familie-skoperede tabeller med én række hver, så et
// hardDeleteFamily()-kald reelt øver hele fremmednøgle-kæden (inkl.
// to-niveau-kæder som task_routine_items -> task_routines -> families),
// ikke kun de tabeller, der refererer families.id direkte.
async function seedFullFamilyDataset(
  db: FakeD1,
  familyId: string,
  ownerUserId: string,
  memberId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO task_routines (id, family_id, name, weekdays, assigned_member_id, created_by_user_id, created_at)
       VALUES ('routine-1', ?, 'Rutine', 'mon', ?, ?, ?)`,
    )
    .bind(familyId, memberId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO task_routine_items (id, routine_id, name, icon, sort_order)
       VALUES ('routine-item-1', 'routine-1', 'Delopgave', 'icon', 0)`,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO tasks (id, family_id, name, icon, assigned_member_id, created_by_user_id, created_at)
       VALUES ('task-1', ?, 'Opgave', 'icon', ?, ?, ?)`,
    )
    .bind(familyId, memberId, ownerUserId, now)
    .run();

  await db
    .prepare(
      `INSERT INTO shopping_lists (id, family_id, name, type, created_at) VALUES ('list-1', ?, 'Liste', 'dagligvarer', ?)`,
    )
    .bind(familyId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO shopping_list_items (id, list_id, name, category, added_by_user_id, created_at)
       VALUES ('item-1', 'list-1', 'Mælk', 'mejeri', ?, ?)`,
    )
    .bind(ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO shopping_list_templates (id, family_id, list_type, name, created_at) VALUES ('template-1', ?, 'dagligvarer', 'Skabelon', ?)`,
    )
    .bind(familyId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO shopping_list_template_items (id, template_id, name) VALUES ('template-item-1', 'template-1', 'Brød')`,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO shopping_item_category_overrides (family_id, list_type, item_name_normalized, category)
       VALUES (?, 'dagligvarer', 'ost', 'mejeri')`,
    )
    .bind(familyId)
    .run();

  await db
    .prepare(
      `INSERT INTO icloud_calendar_connections (id, family_id, apple_id_email, encrypted_app_specific_password, family_member_id, created_by_user_id, created_at)
       VALUES ('icloud-1', ?, 'test@icloud.com', 'encrypted', ?, ?, ?)`,
    )
    .bind(familyId, memberId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO icloud_calendar_sync_state (connection_id, caldav_calendar_url, display_name, updated_at)
       VALUES ('icloud-1', 'https://example.com/cal', 'Kalender', ?)`,
    )
    .bind(now)
    .run();

  await db
    .prepare(
      `INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id) VALUES (?, 'gcal-1', ?)`,
    )
    .bind(familyId, memberId)
    .run();
  await db
    .prepare(
      `INSERT INTO calendar_sync_state (google_calendar_id, family_id, sync_token, updated_at) VALUES ('gcal-1', ?, 'token', ?)`,
    )
    .bind(familyId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO calendar_event_snapshots (google_calendar_id, event_id, safe_title, start, end)
       VALUES ('gcal-1', 'event-1', 'Aftale', ?, ?)`,
    )
    .bind(now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, detected_at, source_updated_at)
       VALUES ('activity-1', ?, 'created', 'Aftale', ?, ?)`,
    )
    .bind(familyId, now, now)
    .run();

  await db
    .prepare(
      `INSERT INTO meal_plan_entries (id, family_id, date, dish_name, created_by_user_id, created_at) VALUES ('meal-1', ?, '2026-09-20', 'Pasta', ?, ?)`,
    )
    .bind(familyId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO birthday_gift_plans (id, family_id, family_member_id, year, gift_idea, created_by_user_id, created_at)
       VALUES ('gift-1', ?, ?, 2026, 'Cykel', ?, ?)`,
    )
    .bind(familyId, memberId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO shared_expenses (id, family_id, description, amount, paid_by_member_id, split_between, expense_date, created_by_user_id, created_at)
       VALUES ('expense-1', ?, 'Indkøb', 100, ?, '[]', ?, ?, ?)`,
    )
    .bind(familyId, memberId, now, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO shared_expense_settlements (id, family_id, debtor_member_id, creditor_member_id, amount, created_by_user_id, created_at)
       VALUES ('settlement-1', ?, ?, ?, 50, ?, ?)`,
    )
    .bind(familyId, memberId, memberId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO allowance_ledger (id, family_id, family_member_id, amount, created_at) VALUES ('ledger-1', ?, ?, 10, ?)`,
    )
    .bind(familyId, memberId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO event_reminders (id, family_id, event_id, offset_minutes, created_by_user_id, created_at)
       VALUES ('reminder-1', ?, 'google-event:gcal-1:event-1', 20, ?, ?)`,
    )
    .bind(familyId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO ics_calendar_subscriptions (id, family_id, url, label, created_by_user_id, created_at)
       VALUES ('ics-1', ?, 'https://example.com/cal.ics', 'Skole', ?, ?)`,
    )
    .bind(familyId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO family_share_links (id, family_id, token, created_by_user_id, included_member_ids, created_at)
       VALUES ('share-1', ?, 'token-1', ?, ?, ?)`,
    )
    .bind(familyId, ownerUserId, memberId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES ('summary-1', ?, '2026-09-14', 'Resumé', ?)`,
    )
    .bind(familyId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO family_enabled_features (family_id, feature_key, enabled_by_user_id, enabled_at) VALUES (?, 'meal-plan', ?, ?)`,
    )
    .bind(familyId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO family_invites (code, family_id, created_by_user_id, created_at) VALUES ('INVITE01', ?, ?, ?)`,
    )
    .bind(familyId, ownerUserId, now)
    .run();
  await db
    .prepare(
      `INSERT INTO user_activity_cursors (user_id, family_id, last_seen_at) VALUES (?, ?, ?)`,
    )
    .bind(ownerUserId, familyId, now)
    .run();
  // Sprint 53: child_sessions.family_member_id -> family_members(id) — uden
  // denne rad ville testen ikke opdage, hvis hardDeleteFamily() glemte at
  // rydde den FØR family_members selv slettes.
  await db
    .prepare(
      `INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES ('child-session-1', ?, ?, ?)`,
    )
    .bind(memberId, now, new Date(Date.now() + 100_000).toISOString())
    .run();
}

describe("accountDeletion", () => {
  let db: ReturnType<typeof createFakeD1>;

  beforeEach(() => {
    db = createFakeD1();
  });

  describe("isReauthFresh", () => {
    it("is false when never reauthenticated", () => {
      expect(isReauthFresh(null)).toBe(false);
    });

    it("is true within the freshness window", () => {
      const now = new Date("2026-09-19T12:10:00.000Z");
      expect(isReauthFresh("2026-09-19T12:05:00.000Z", now)).toBe(true);
    });

    it("is false once the freshness window has passed", () => {
      const now = new Date("2026-09-19T12:20:00.000Z");
      expect(isReauthFresh("2026-09-19T12:05:00.000Z", now)).toBe(false);
    });

    it("rejects invalid and future timestamps", () => {
      const now = new Date("2026-09-19T12:10:00.000Z");
      expect(isReauthFresh("not-a-date", now)).toBe(false);
      expect(isReauthFresh("2026-09-19T12:10:01.000Z", now)).toBe(false);
    });
  });

  describe("account deletion", () => {
    it("requires the exact destructive confirmation", async () => {
      await seedUser(db, { id: "user-1" });

      await expect(
        requestAccountDeletion(db as never, {
          userId: "user-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: "slet min konto",
        }),
      ).rejects.toThrow(InvalidDeletionConfirmationError);
    });

    it("blocks an owner until ownership has been transferred", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedUser(db, { id: "member-1" });
      await seedFamily(db, "family-1", "owner-1", ["member-1"]);

      await expect(
        requestAccountDeletion(db as never, {
          userId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toMatchObject({
        families: [{ familyId: "family-1", familyName: "Testfamilien", memberCount: 2 }],
      });

      await db.batch([
        db.prepare("UPDATE families SET owner_user_id = ? WHERE id = ?").bind("member-1", "family-1"),
        db
          .prepare("UPDATE family_memberships SET role = 'admin' WHERE family_id = ? AND user_id = ?")
          .bind("family-1", "owner-1"),
        db
          .prepare("UPDATE family_memberships SET role = 'owner' WHERE family_id = ? AND user_id = ?")
          .bind("family-1", "member-1"),
      ]);

      await expect(
        requestAccountDeletion(db as never, {
          userId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).resolves.toBeDefined();
    });

    it("blocks a sole owner so an active family cannot become ownerless", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");

      await expect(
        requestAccountDeletion(db as never, {
          userId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toThrow(AccountOwnsFamiliesError);
    });

    it("reports every active family the account owns", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");
      await seedFamily(db, "family-2", "owner-1");

      await expect(
        requestAccountDeletion(db as never, {
          userId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toMatchObject({
        families: expect.arrayContaining([
          expect.objectContaining({ familyId: "family-1" }),
          expect.objectContaining({ familyId: "family-2" }),
        ]),
      });
    });

    it("preview lists only active (non-deleted) family memberships", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");

      const preview = await previewAccountDeletion(db as never, "owner-1");

      expect(preview.memberships).toEqual([
        { familyId: "family-1", familyName: "Testfamilien", role: "owner", memberCount: 1 },
      ]);
    });

    it("hides users on families that are already scheduled for deletion", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");
      await db
        .prepare("UPDATE families SET deleted_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), "family-1")
        .run();

      const preview = await previewAccountDeletion(db as never, "owner-1");

      expect(preview.memberships).toEqual([]);
    });

    it("sets deleted_at, deletes sessions, and schedules a purge ~30 days out", async () => {
      await seedUser(db, { id: "user-1" });
      await db
        .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
        .bind("session-1", "user-1", new Date().toISOString(), new Date(Date.now() + 1000).toISOString())
        .run();

      const now = new Date("2026-09-19T12:00:00.000Z");
      const { purgeAfter } = await requestAccountDeletion(db as never, {
        userId: "user-1",
        reauthenticatedAt: now.toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      const expectedPurgeAfter = new Date(now.getTime() + DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      // requestAccountDeletion beregner sit eget "now" internt, så vi
      // sammenligner kun på dagsniveau i stedet for millisekund-præcist.
      expect(new Date(purgeAfter).toDateString()).toBe(expectedPurgeAfter.toDateString());

      const user = await db
        .prepare("SELECT deleted_at AS deletedAt FROM users WHERE id = ?")
        .bind("user-1")
        .first<{ deletedAt: string | null }>();
      expect(user?.deletedAt).not.toBeNull();

      const session = await db
        .prepare("SELECT id FROM sessions WHERE id = ?")
        .bind("session-1")
        .first();
      expect(session).toBeNull();
    });

    it("refuses a second open deletion request for the same account", async () => {
      await seedUser(db, { id: "user-1" });
      await requestAccountDeletion(db as never, {
        userId: "user-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      await expect(
        requestAccountDeletion(db as never, {
          userId: "user-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toThrow(DeletionAlreadyRequestedError);
    });

    it("cancel clears deleted_at and lets a new request be made afterwards", async () => {
      await seedUser(db, { id: "user-1" });
      await requestAccountDeletion(db as never, {
        userId: "user-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      const cancelled = await cancelAccountDeletion(db as never, "user-1");
      expect(cancelled).toBe(true);

      const user = await db
        .prepare("SELECT deleted_at AS deletedAt FROM users WHERE id = ?")
        .bind("user-1")
        .first<{ deletedAt: string | null }>();
      expect(user?.deletedAt).toBeNull();

      await expect(
        requestAccountDeletion(db as never, {
          userId: "user-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).resolves.toBeDefined();
    });

    it("cancel returns false when there is no open request", async () => {
      await seedUser(db, { id: "user-1" });
      expect(await cancelAccountDeletion(db as never, "user-1")).toBe(false);
    });
  });

  describe("family deletion", () => {
    it("requires the exact family name", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");

      await expect(
        requestFamilyDeletion(db as never, {
          familyId: "family-1",
          requestedByUserId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: "Forkert navn",
        }),
      ).rejects.toThrow(InvalidDeletionConfirmationError);
    });

    it("previews member/data counts", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");
      await seedFamilyMember(db, "family-1", "member-1", "owner-1");
      await db
        .prepare(
          "INSERT INTO tasks (id, family_id, name, icon, created_by_user_id, created_at) VALUES ('task-1', ?, 'X', 'icon', ?, ?)",
        )
        .bind("family-1", "owner-1", new Date().toISOString())
        .run();

      const preview = await previewFamilyDeletion(db as never, "family-1");

      expect(preview.familyName).toBe("Testfamilien");
      expect(preview.memberCount).toBe(1);
      expect(preview.taskCount).toBe(1);
    });

    it("hides the family from every member once requested, and only the requester can cancel it", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedUser(db, { id: "member-1" });
      await seedFamily(db, "family-1", "owner-1", ["member-1"]);

      await requestFamilyDeletion(db as never, {
        familyId: "family-1",
        requestedByUserId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: "Testfamilien",
      });

      const family = await db
        .prepare("SELECT deleted_at AS deletedAt FROM families WHERE id = ?")
        .bind("family-1")
        .first<{ deletedAt: string | null }>();
      expect(family?.deletedAt).not.toBeNull();

      // En anden bruger end den, der bad om sletningen, kan ikke fortryde.
      expect(
        await cancelFamilyDeletion(db as never, { familyId: "family-1", requestedByUserId: "member-1" }),
      ).toBe(false);

      expect(
        await cancelFamilyDeletion(db as never, { familyId: "family-1", requestedByUserId: "owner-1" }),
      ).toBe(true);

      const restored = await db
        .prepare("SELECT deleted_at AS deletedAt FROM families WHERE id = ?")
        .bind("family-1")
        .first<{ deletedAt: string | null }>();
      expect(restored?.deletedAt).toBeNull();
    });

    it("also cancels the owner's pending account deletion when restoring the family", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");

      await requestFamilyDeletion(db as never, {
        familyId: "family-1",
        requestedByUserId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: "Testfamilien",
      });
      await requestAccountDeletion(db as never, {
        userId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      await expect(
        cancelFamilyDeletion(db as never, {
          familyId: "family-1",
          requestedByUserId: "owner-1",
        }),
      ).resolves.toBe(true);

      const user = await db
        .prepare("SELECT deleted_at AS deletedAt FROM users WHERE id = 'owner-1'")
        .first<{ deletedAt: string | null }>();
      const openAccountDeletion = await db
        .prepare(
          `SELECT id FROM deletion_requests
           WHERE scope = 'account' AND target_id = 'owner-1' AND cancelled_at IS NULL`,
        )
        .first();

      expect(user?.deletedAt).toBeNull();
      expect(openAccountDeletion).toBeNull();
      await expect(
        requestAccountDeletion(db as never, {
          userId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: ACCOUNT_DELETION_CONFIRMATION,
        }),
      ).rejects.toThrow(AccountOwnsFamiliesError);
    });

    it("refuses a second open deletion request for the same family", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedFamily(db, "family-1", "owner-1");

      await requestFamilyDeletion(db as never, {
        familyId: "family-1",
        requestedByUserId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: "Testfamilien",
      });

      await expect(
        requestFamilyDeletion(db as never, {
          familyId: "family-1",
          requestedByUserId: "owner-1",
          reauthenticatedAt: new Date().toISOString(),
          confirmation: "Testfamilien",
        }),
      ).rejects.toThrow(DeletionAlreadyRequestedError);
    });
  });

  describe("purgeExpiredDeletions", () => {
    it("does nothing while the retention window has not elapsed", async () => {
      await seedUser(db, { id: "user-1" });
      await requestAccountDeletion(db as never, {
        userId: "user-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });

      await purgeExpiredDeletions(createFakeEnv({ DB: db as never }));

      const user = await db
        .prepare("SELECT name AS name FROM users WHERE id = ?")
        .bind("user-1")
        .first<{ name: string }>();
      expect(user?.name).not.toBe("Tidligere medlem");
    });

    it("does not purge a cancelled request even past purge_after", async () => {
      await seedUser(db, { id: "user-1", name: "Original Navn" });
      await requestAccountDeletion(db as never, {
        userId: "user-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });
      await cancelAccountDeletion(db as never, "user-1");
      // Simulerer at fortrydelsesperioden er udløbet, EFTER at anmodningen
      // allerede blev fortrudt.
      await db
        .prepare("UPDATE deletion_requests SET purge_after = ? WHERE target_id = ?")
        .bind(new Date(Date.now() - 1000).toISOString(), "user-1")
        .run();

      await purgeExpiredDeletions(createFakeEnv({ DB: db as never }));

      const user = await db
        .prepare("SELECT name AS name FROM users WHERE id = ?")
        .bind("user-1")
        .first<{ name: string }>();
      expect(user?.name).toBe("Original Navn");
    });

    it("anonymizes a user past purge_after but keeps their historical content attributed to them", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedUser(db, { id: "member-1", name: "Medlem Navn", email: "medlem@example.com" });
      await seedFamily(db, "family-1", "owner-1", ["member-1"]);
      await seedFamilyMember(db, "family-1", "fm-member-1", "member-1");
      const now = new Date().toISOString();
      await db
        .prepare(
          "INSERT INTO tasks (id, family_id, name, icon, created_by_user_id, created_at) VALUES ('task-1', ?, 'Lav mad', 'icon', ?, ?)",
        )
        .bind("family-1", "member-1", now)
        .run();

      await requestAccountDeletion(db as never, {
        userId: "member-1",
        reauthenticatedAt: now,
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });
      // Fremtvinger at fortrydelsesperioden er udløbet.
      await db
        .prepare("UPDATE deletion_requests SET purge_after = ? WHERE target_id = ?")
        .bind(new Date(Date.now() - 1000).toISOString(), "member-1")
        .run();

      await purgeExpiredDeletions(createFakeEnv({ DB: db as never }));

      const anonymized = await db
        .prepare("SELECT name AS name, email AS email, google_sub AS googleSub FROM users WHERE id = ?")
        .bind("member-1")
        .first<{ name: string; email: string; googleSub: string }>();
      expect(anonymized?.name).toBe("Tidligere medlem");
      expect(anonymized?.email).not.toBe("medlem@example.com");
      expect(anonymized?.googleSub).toContain("deleted:");

      // Opgaven består, og peger stadig på den (nu anonymiserede) bruger.
      const task = await db
        .prepare(
          `SELECT tasks.name AS name, users.name AS creatorName FROM tasks
           JOIN users ON users.id = tasks.created_by_user_id WHERE tasks.id = 'task-1'`,
        )
        .first<{ name: string; creatorName: string }>();
      expect(task?.name).toBe("Lav mad");
      expect(task?.creatorName).toBe("Tidligere medlem");

      // Medlemskabet af familien er væk, men familien selv består.
      const membership = await db
        .prepare("SELECT user_id FROM family_memberships WHERE family_id = ? AND user_id = ?")
        .bind("family-1", "member-1")
        .first();
      expect(membership).toBeNull();

      const family = await db.prepare("SELECT id FROM families WHERE id = ?").bind("family-1").first();
      expect(family).not.toBeNull();

      const familyMember = await db
        .prepare("SELECT linked_user_id AS linkedUserId FROM family_members WHERE id = 'fm-member-1'")
        .first<{ linkedUserId: string | null }>();
      expect(familyMember?.linkedUserId).toBeNull();

      const purgedRequest = await db
        .prepare("SELECT purged_at AS purgedAt FROM deletion_requests WHERE target_id = ?")
        .bind("member-1")
        .first<{ purgedAt: string | null }>();
      expect(purgedRequest?.purgedAt).not.toBeNull();
    });

    it("hard-deletes an entire family past purge_after without violating foreign keys", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedUser(db, { id: "member-1" });
      await seedFamily(db, "family-1", "owner-1", ["member-1"]);
      await seedFamilyMember(db, "family-1", "fm-member-1", "member-1");
      await seedFullFamilyDataset(db, "family-1", "owner-1", "fm-member-1");

      await requestFamilyDeletion(db as never, {
        familyId: "family-1",
        requestedByUserId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: "Testfamilien",
      });
      await db
        .prepare("UPDATE deletion_requests SET purge_after = ? WHERE target_id = ?")
        .bind(new Date(Date.now() - 1000).toISOString(), "family-1")
        .run();

      // Skal gennemføres uden at kaste en fremmednøgle-fejl (fakeD1 kører
      // med PRAGMA foreign_keys = ON, samme håndhævelse som rigtig D1).
      await expect(purgeExpiredDeletions(createFakeEnv({ DB: db as never }))).resolves.toBeUndefined();

      const family = await db.prepare("SELECT id FROM families WHERE id = ?").bind("family-1").first();
      expect(family).toBeNull();

      const task = await db.prepare("SELECT id FROM tasks WHERE family_id = ?").bind("family-1").first();
      expect(task).toBeNull();

      const routineItem = await db
        .prepare("SELECT id FROM task_routine_items WHERE routine_id = 'routine-1'")
        .first();
      expect(routineItem).toBeNull();

      const templateItem = await db
        .prepare("SELECT id FROM shopping_list_template_items WHERE template_id = 'template-1'")
        .first();
      expect(templateItem).toBeNull();

      const snapshot = await db
        .prepare("SELECT event_id FROM calendar_event_snapshots WHERE google_calendar_id = 'gcal-1'")
        .first();
      expect(snapshot).toBeNull();

      const childSession = await db
        .prepare("SELECT id FROM child_sessions WHERE id = 'child-session-1'")
        .first();
      expect(childSession).toBeNull();

      // Medlemmernes egne konti overlever en familiesletning — kun
      // deres medlemskab af DENNE familie forsvinder.
      const owner = await db.prepare("SELECT id FROM users WHERE id = 'owner-1'").first();
      expect(owner).not.toBeNull();
    });

    it("purges account and family requests in the same run", async () => {
      await seedUser(db, { id: "owner-1" });
      await seedUser(db, { id: "solo-user" });
      await seedFamily(db, "family-1", "owner-1");

      await requestAccountDeletion(db as never, {
        userId: "solo-user",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
      });
      await requestFamilyDeletion(db as never, {
        familyId: "family-1",
        requestedByUserId: "owner-1",
        reauthenticatedAt: new Date().toISOString(),
        confirmation: "Testfamilien",
      });
      await db
        .prepare("UPDATE deletion_requests SET purge_after = ?")
        .bind(new Date(Date.now() - 1000).toISOString())
        .run();

      await purgeExpiredDeletions(createFakeEnv({ DB: db as never }));

      const purgedCount = await db
        .prepare("SELECT COUNT(*) AS count FROM deletion_requests WHERE purged_at IS NOT NULL")
        .first<{ count: number }>();
      expect(purgedCount?.count).toBe(2);
    });
  });
});
