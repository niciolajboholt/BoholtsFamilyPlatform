import { describe, expect, it } from "vitest";

import { createFakeD1, seedUser } from "../testing/fakeD1";
import { buildFamilyExport, FAMILY_EXPORT_POLICY } from "./dataExport";

async function seedBaseFamily(db: ReturnType<typeof createFakeD1>, familyId = "family-1") {
  await seedUser(db, { id: "owner-1", email: "owner@example.com" });
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Testfamilien", "owner-1", now)
    .run();
  await db
    .prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    )
    .bind(familyId, "owner-1", now)
    .run();
  await db
    .prepare(
      `INSERT INTO family_members
         (id, family_id, name, color, is_placeholder_name, linked_user_id, created_at)
       VALUES ('member-1', ?, 'Ejer', '#ffffff', 0, 'owner-1', ?)`,
    )
    .bind(familyId, now)
    .run();
  return now;
}

describe("family data export", () => {
  it("classifies every table in the fully migrated application schema", async () => {
    const db = createFakeD1();
    const { results } = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all<{ name: string }>();

    const classified = [
      ...FAMILY_EXPORT_POLICY.exportedTables,
      ...FAMILY_EXPORT_POLICY.excludedOperationalTables,
      ...FAMILY_EXPORT_POLICY.nonFamilyTables,
    ].sort();

    expect(classified).toEqual(results.map((row) => row.name).sort());
    expect(new Set(classified).size).toBe(classified.length);
  });

  it("includes user-authored family datasets that Sprint 50 originally omitted", async () => {
    const db = createFakeD1();
    const now = await seedBaseFamily(db);

    await db
      .prepare(
        `INSERT INTO task_routines
           (id, family_id, name, weekdays, created_by_user_id, created_at)
         VALUES ('routine-1', 'family-1', 'Morgen', 'mon', 'owner-1', ?)`,
      )
      .bind(now)
      .run();
    await db
      .prepare(
        `INSERT INTO task_routine_items (id, routine_id, name, icon, sort_order)
         VALUES ('routine-item-1', 'routine-1', 'Børst tænder', 'tooth', 0)`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO shopping_list_templates (id, family_id, list_type, name, created_at)
         VALUES ('template-1', 'family-1', 'dagligvarer', 'Weekend', ?)`,
      )
      .bind(now)
      .run();
    await db
      .prepare(
        `INSERT INTO shopping_list_template_items (id, template_id, name)
         VALUES ('template-item-1', 'template-1', 'Brød')`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO shopping_item_category_overrides
           (family_id, list_type, item_name_normalized, category)
         VALUES ('family-1', 'dagligvarer', 'brød', 'Bager')`,
      )
      .run();
    await db
      .prepare(
        `INSERT INTO event_reminders
           (id, family_id, event_id, offset_minutes, created_by_user_id, created_at)
         VALUES ('reminder-1', 'family-1', 'event-1', 20, 'owner-1', ?)`,
      )
      .bind(now)
      .run();
    await db
      .prepare(
        `INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at)
         VALUES ('summary-1', 'family-1', '2026-09-14', 'Ugens resumé', ?)`,
      )
      .bind(now)
      .run();
    await db
      .prepare(
        `INSERT INTO calendar_activity_log
           (id, family_id, change_type, safe_title, detected_at, google_calendar_id)
         VALUES ('activity-1', 'family-1', 'created', 'Fodbold', ?, 'calendar-1')`,
      )
      .bind(now)
      .run();

    const exported = await buildFamilyExport(db as never, "family-1");

    expect(exported.taskRoutineItems.map((row) => row.id)).toContain("routine-item-1");
    expect(exported.shoppingListTemplateItems.map((row) => row.id)).toContain("template-item-1");
    expect(exported.shoppingItemCategoryOverrides).toContainEqual(
      expect.objectContaining({ itemNameNormalized: "brød" }),
    );
    expect(exported.eventReminders.map((row) => row.id)).toContain("reminder-1");
    expect(exported.familyWeeklySummaries.map((row) => row.id)).toContain("summary-1");
    expect(exported.calendarActivityLog.map((row) => row.id)).toContain("activity-1");
  });

  it("exports connection metadata without bearer credentials or encrypted secrets", async () => {
    const db = createFakeD1();
    const now = await seedBaseFamily(db);
    const shareToken = "live-public-share-token";
    const icsUrl = "https://calendar.example/private/secret-token/calendar.ics?key=bearer";
    const encryptedPassword = "encrypted-icloud-password";

    await db
      .prepare(
        `INSERT INTO family_share_links
           (id, family_id, token, created_by_user_id, included_member_ids, created_at)
         VALUES ('share-1', 'family-1', ?, 'owner-1', 'member-1', ?)`,
      )
      .bind(shareToken, now)
      .run();
    await db
      .prepare(
        `INSERT INTO ics_calendar_subscriptions
           (id, family_id, url, label, family_member_id, created_by_user_id, created_at)
         VALUES ('ics-1', 'family-1', ?, 'Skole', 'member-1', 'owner-1', ?)`,
      )
      .bind(icsUrl, now)
      .run();
    await db
      .prepare(
        `INSERT INTO icloud_calendar_connections
           (id, family_id, apple_id_email, encrypted_app_specific_password,
            family_member_id, created_by_user_id, created_at)
         VALUES ('icloud-1', 'family-1', 'owner@icloud.com', ?, 'member-1', 'owner-1', ?)`,
      )
      .bind(encryptedPassword, now)
      .run();

    const exported = await buildFamilyExport(db as never, "family-1");
    const serialized = JSON.stringify(exported);

    expect(exported.familyShareLinks).toContainEqual(expect.objectContaining({ id: "share-1" }));
    expect(exported.icsCalendarSubscriptions).toContainEqual(
      expect.objectContaining({ id: "ics-1", label: "Skole" }),
    );
    expect(exported.icloudCalendarConnections).toContainEqual(
      expect.objectContaining({ id: "icloud-1", appleIdEmail: "owner@icloud.com" }),
    );
    expect(serialized).not.toContain(shareToken);
    expect(serialized).not.toContain(icsUrl);
    expect(serialized).not.toContain(encryptedPassword);
    expect(exported.familyShareLinks[0]).not.toHaveProperty("token");
    expect(exported.icsCalendarSubscriptions[0]).not.toHaveProperty("url");
    expect(exported.icloudCalendarConnections[0]).not.toHaveProperty(
      "encrypted_app_specific_password",
    );
  });

  it("does not leak rows from another family", async () => {
    const db = createFakeD1();
    const now = await seedBaseFamily(db);
    await seedUser(db, { id: "owner-2" });
    await db
      .prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind("family-2", "Anden familie", "owner-2", now)
      .run();
    await db
      .prepare(
        `INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at)
         VALUES ('secret-summary', 'family-2', '2026-09-14', 'ANDEN FAMILIES DATA', ?)`,
      )
      .bind(now)
      .run();

    const exported = await buildFamilyExport(db as never, "family-1");

    expect(JSON.stringify(exported)).not.toContain("ANDEN FAMILIES DATA");
  });
});
