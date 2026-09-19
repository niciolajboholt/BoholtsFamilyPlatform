// Sprint 50: server-side dataeksport — dækker familiedata i D1, som det
// lokale "Eksportér data" (src/features/calendar/preferences/dataBackupStorage.ts)
// aldrig har rørt ved (kun enhedens localStorage). Se
// 01_Project_Documentation/Development/50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md.
//
// To eksport-omfang, jf. Nicolajs beslutning på planens åbne
// produktbeslutning 3:
// - "family": ejeren kan eksportere ALT, inkl. andre medlemmers navn/
//   e-mail — ruten (familyDeletion.ts) håndhæver at kun ejeren kan bede
//   om dette omfang, denne fil håndhæver det ikke selv.
// - "member": et almindeligt medlem kan kun eksportere sin egen konto,
//   sit eget familiemedlem-opslag og sin egen kalender/opgaver — INGEN
//   andre medlemmers personoplysninger.
//
// Krypterede/følsomme felter er ALDRIG med i nogen af de to omfang: intet
// OAuth-refresh-token, ingen iCloud-appkodeord, aktive delelinktokens eller
// fulde ICS-URL'er. Sidstnævnte er bearer credentials, selv om de historisk
// er gemt i klartekst. Eksporten indeholder kun forbindelsesmetadata.

// Alle applikationstabeller er bevidst klassificeret. Testen i
// dataExport.test.ts sammenholder disse lister med det fuldt migrerede schema,
// så en ny tabel ikke stiltiende kan blive glemt i eksportbeslutningen.
export const FAMILY_EXPORT_POLICY = {
  exportedTables: [
    "families",
    "family_memberships",
    "family_members",
    "calendar_member_mappings",
    "shopping_lists",
    "shopping_list_items",
    "shopping_item_category_overrides",
    "shopping_list_templates",
    "shopping_list_template_items",
    "task_routines",
    "task_routine_items",
    "tasks",
    "family_share_links",
    "family_weekly_summaries",
    "event_reminders",
    "calendar_activity_log",
    "ics_calendar_subscriptions",
    "meal_plan_entries",
    "allowance_ledger",
    "birthday_gift_plans",
    "shared_expenses",
    "shared_expense_settlements",
    "family_enabled_features",
    "icloud_calendar_connections",
  ],
  excludedOperationalTables: [
    // Engangskoder og synk-/cursor-tilstand er credentials eller
    // regenererbar driftsdata, ikke brugerens portable familiedata.
    "family_invites",
    "user_activity_cursors",
    "calendar_sync_state",
    "calendar_event_snapshots",
    "icloud_calendar_sync_state",
    "deletion_requests",
  ],
  nonFamilyTables: [
    "users",
    "sessions",
    "google_connections",
    "push_subscriptions",
    "rate_limit_attempts",
    "feedback",
  ],
} as const;

export interface MemberExport {
  exportedAt: string;
  scope: "member";
  user: { id: string; email: string; name: string; createdAt: string } | null;
  familyMember: Record<string, unknown> | null;
  tasks: Record<string, unknown>[];
  calendarMemberMappings: Record<string, unknown>[];
}

export async function buildMemberExport(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<MemberExport> {
  const user = await db
    .prepare("SELECT id, email, name, created_at AS createdAt FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; email: string; name: string; createdAt: string }>();

  const familyMember = await db
    .prepare(
      `SELECT id, name, color, relation, birthday FROM family_members
       WHERE family_id = ? AND linked_user_id = ?`,
    )
    .bind(familyId, userId)
    .first<Record<string, unknown>>();

  const tasks = await db
    .prepare(
      `SELECT tasks.* FROM tasks
       WHERE family_id = ?
             AND (created_by_user_id = ?
                  OR assigned_member_id = (
                    SELECT id FROM family_members WHERE family_id = ? AND linked_user_id = ?
                  ))`,
    )
    .bind(familyId, userId, familyId, userId)
    .all<Record<string, unknown>>();

  const calendarMemberMappings = await db
    .prepare(
      `SELECT calendar_member_mappings.* FROM calendar_member_mappings
       WHERE family_id = ?
             AND family_member_id = (
               SELECT id FROM family_members WHERE family_id = ? AND linked_user_id = ?
             )`,
    )
    .bind(familyId, familyId, userId)
    .all<Record<string, unknown>>();

  return {
    exportedAt: new Date().toISOString(),
    scope: "member",
    user: user ?? null,
    familyMember: familyMember ?? null,
    tasks: tasks.results,
    calendarMemberMappings: calendarMemberMappings.results,
  };
}

export interface FamilyExport {
  exportedAt: string;
  scope: "family";
  family: Record<string, unknown> | null;
  members: Record<string, unknown>[];
  memberships: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  taskRoutines: Record<string, unknown>[];
  taskRoutineItems: Record<string, unknown>[];
  shoppingLists: Record<string, unknown>[];
  shoppingListItems: Record<string, unknown>[];
  shoppingItemCategoryOverrides: Record<string, unknown>[];
  shoppingListTemplates: Record<string, unknown>[];
  shoppingListTemplateItems: Record<string, unknown>[];
  mealPlanEntries: Record<string, unknown>[];
  birthdayGiftPlans: Record<string, unknown>[];
  sharedExpenses: Record<string, unknown>[];
  sharedExpenseSettlements: Record<string, unknown>[];
  allowanceLedger: Record<string, unknown>[];
  calendarMemberMappings: Record<string, unknown>[];
  eventReminders: Record<string, unknown>[];
  familyWeeklySummaries: Record<string, unknown>[];
  calendarActivityLog: Record<string, unknown>[];
  icsCalendarSubscriptions: Record<string, unknown>[];
  icloudCalendarConnections: Record<string, unknown>[];
  familyShareLinks: Record<string, unknown>[];
  familyEnabledFeatures: Record<string, unknown>[];
}

async function allByFamily(
  db: D1Database,
  sql: string,
  familyId: string,
): Promise<Record<string, unknown>[]> {
  const result = await db.prepare(sql).bind(familyId).all<Record<string, unknown>>();
  return result.results;
}

export async function buildFamilyExport(db: D1Database, familyId: string): Promise<FamilyExport> {
  const family = await db
    .prepare(
      `SELECT id, name, owner_user_id AS ownerUserId,
              ai_weekly_summary_enabled AS aiWeeklySummaryEnabled,
              created_at AS createdAt
       FROM families WHERE id = ?`,
    )
    .bind(familyId)
    .first<Record<string, unknown>>();

  const [
    members,
    memberships,
    tasks,
    taskRoutines,
    taskRoutineItems,
    shoppingLists,
    shoppingListItems,
    shoppingItemCategoryOverrides,
    shoppingListTemplates,
    shoppingListTemplateItems,
    mealPlanEntries,
    birthdayGiftPlans,
    sharedExpenses,
    sharedExpenseSettlements,
    allowanceLedger,
    calendarMemberMappings,
    eventReminders,
    familyWeeklySummaries,
    calendarActivityLog,
    icsCalendarSubscriptions,
    icloudCalendarConnections,
    familyShareLinks,
    familyEnabledFeatures,
  ] = await Promise.all([
    allByFamily(
      db,
      `SELECT id, name, color, relation, birthday,
              is_placeholder_name AS isPlaceholderName,
              linked_user_id AS linkedUserId, created_at AS createdAt
       FROM family_members WHERE family_id = ?`,
      familyId,
    ),
    db
      .prepare(
        `SELECT users.id AS userId, users.email AS email, users.name AS name,
                users.created_at AS userCreatedAt,
                family_memberships.role AS role, family_memberships.joined_at AS joinedAt
         FROM family_memberships
         JOIN users ON users.id = family_memberships.user_id
         WHERE family_memberships.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, name, icon,
              assigned_member_id AS assignedMemberId, time_of_day AS timeOfDay,
              is_done AS isDone, routine_item_id AS routineItemId,
              task_date AS taskDate, created_by_user_id AS createdByUserId,
              created_at AS createdAt, done_at AS doneAt, reminded_at AS remindedAt,
              reward_amount AS rewardAmount
       FROM tasks WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, name,
              assigned_member_id AS assignedMemberId, weekdays,
              created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM task_routines WHERE family_id = ?`,
      familyId,
    ),
    db
      .prepare(
        `SELECT items.id, items.routine_id AS routineId, items.name, items.icon,
                items.time_of_day AS timeOfDay, items.sort_order AS sortOrder
         FROM task_routine_items items
         JOIN task_routines routines ON routines.id = items.routine_id
         WHERE routines.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, name, created_at AS createdAt, type
       FROM shopping_lists WHERE family_id = ?`,
      familyId,
    ),
    db
      .prepare(
        `SELECT shopping_list_items.id, shopping_list_items.list_id AS listId,
                shopping_list_items.name, shopping_list_items.category,
                shopping_list_items.is_checked AS isChecked,
                shopping_list_items.added_by_user_id AS addedByUserId,
                shopping_list_items.created_at AS createdAt,
                shopping_list_items.checked_at AS checkedAt
         FROM shopping_list_items
         JOIN shopping_lists ON shopping_lists.id = shopping_list_items.list_id
         WHERE shopping_lists.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(
      db,
      `SELECT family_id AS familyId, list_type AS listType,
              item_name_normalized AS itemNameNormalized, category
       FROM shopping_item_category_overrides WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, list_type AS listType, name,
              created_at AS createdAt
       FROM shopping_list_templates WHERE family_id = ?`,
      familyId,
    ),
    db
      .prepare(
        `SELECT items.id, items.template_id AS templateId, items.name
         FROM shopping_list_template_items items
         JOIN shopping_list_templates templates ON templates.id = items.template_id
         WHERE templates.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, date, dish_name AS dishName,
              created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM meal_plan_entries WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, family_member_id AS familyMemberId,
              year, gift_idea AS giftIdea, budget_amount AS budgetAmount,
              is_purchased AS isPurchased, created_by_user_id AS createdByUserId,
              created_at AS createdAt
       FROM birthday_gift_plans WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, description, amount,
              paid_by_member_id AS paidByMemberId, split_between AS splitBetween,
              expense_date AS expenseDate, created_by_user_id AS createdByUserId,
              created_at AS createdAt
       FROM shared_expenses WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, debtor_member_id AS debtorMemberId,
              creditor_member_id AS creditorMemberId, amount,
              created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM shared_expense_settlements WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, family_member_id AS familyMemberId,
              amount, task_id AS taskId, created_at AS createdAt
       FROM allowance_ledger WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT family_id AS familyId, google_calendar_id AS googleCalendarId,
              family_member_id AS familyMemberId
       FROM calendar_member_mappings WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, event_id AS eventId,
              offset_minutes AS offsetMinutes, created_by_user_id AS createdByUserId,
              created_at AS createdAt,
              last_sent_occurrence_start AS lastSentOccurrenceStart
       FROM event_reminders WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, week_start AS weekStart, content,
              created_at AS createdAt
       FROM family_weekly_summaries WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, change_type AS changeType,
              safe_title AS safeTitle, old_start AS oldStart, new_start AS newStart,
              source_updated_at AS sourceUpdatedAt, detected_at AS detectedAt,
              google_calendar_id AS googleCalendarId
       FROM calendar_activity_log WHERE family_id = ?`,
      familyId,
    ),
    // Den fulde url er et bearer credential og udelades. Metadata er nok
    // til indsigt uden at gøre eksportfilen til en adgangsnøgle.
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, label,
              family_member_id AS familyMemberId,
              created_by_user_id AS createdByUserId,
              last_fetched_at AS lastFetchedAt, last_fetch_status AS lastFetchStatus,
              created_at AS createdAt, color
       FROM ics_calendar_subscriptions WHERE family_id = ?`,
      familyId,
    ),
    // encrypted_app_specific_password er ALDRIG med — eksplicit kolonneliste,
    // ikke SELECT *.
    allByFamily(
      db,
      `SELECT id, family_id AS familyId, apple_id_email AS appleIdEmail,
              family_member_id AS familyMemberId, created_by_user_id AS createdByUserId,
              created_at AS createdAt
       FROM icloud_calendar_connections WHERE family_id = ?`,
      familyId,
    ),
    // token er bevidst udeladt — det aktive offentlige link er et bearer
    // credential. Indstillinger/status kan eksporteres sikkert.
    allByFamily(
      db,
      `SELECT id, family_id AS familyId,
              created_by_user_id AS createdByUserId,
              included_member_ids AS includedMemberIds,
              created_at AS createdAt, revoked_at AS revokedAt,
              include_description AS includeDescription,
              include_location AS includeLocation
       FROM family_share_links WHERE family_id = ?`,
      familyId,
    ),
    allByFamily(
      db,
      `SELECT family_id AS familyId, feature_key AS featureKey,
              enabled_by_user_id AS enabledByUserId, enabled_at AS enabledAt
       FROM family_enabled_features WHERE family_id = ?`,
      familyId,
    ),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    scope: "family",
    family: family ?? null,
    members,
    memberships,
    tasks,
    taskRoutines,
    taskRoutineItems,
    shoppingLists,
    shoppingListItems,
    shoppingItemCategoryOverrides,
    shoppingListTemplates,
    shoppingListTemplateItems,
    mealPlanEntries,
    birthdayGiftPlans,
    sharedExpenses,
    sharedExpenseSettlements,
    allowanceLedger,
    calendarMemberMappings,
    eventReminders,
    familyWeeklySummaries,
    calendarActivityLog,
    icsCalendarSubscriptions,
    icloudCalendarConnections,
    familyShareLinks,
    familyEnabledFeatures,
  };
}
