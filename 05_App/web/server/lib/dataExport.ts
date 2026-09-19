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
// OAuth-refresh-token, ingen iCloud-appkodeord. ics_calendar_subscriptions.url
// er en bevidst undtagelse — den gemmes i klartekst i forvejen (se
// 0018_ics_calendar_subscriptions.sql's kommentar), så at udelade den fra en
// brugers egen eksport ville skjule data uden sikkerhedsgevinst.

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
  shoppingLists: Record<string, unknown>[];
  shoppingListItems: Record<string, unknown>[];
  shoppingListTemplates: Record<string, unknown>[];
  mealPlanEntries: Record<string, unknown>[];
  birthdayGiftPlans: Record<string, unknown>[];
  sharedExpenses: Record<string, unknown>[];
  sharedExpenseSettlements: Record<string, unknown>[];
  allowanceLedger: Record<string, unknown>[];
  calendarMemberMappings: Record<string, unknown>[];
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
    .prepare("SELECT id, name, created_at AS createdAt FROM families WHERE id = ?")
    .bind(familyId)
    .first<Record<string, unknown>>();

  const [
    members,
    memberships,
    tasks,
    taskRoutines,
    shoppingLists,
    shoppingListItems,
    shoppingListTemplates,
    mealPlanEntries,
    birthdayGiftPlans,
    sharedExpenses,
    sharedExpenseSettlements,
    allowanceLedger,
    calendarMemberMappings,
    icsCalendarSubscriptions,
    icloudCalendarConnections,
    familyShareLinks,
    familyEnabledFeatures,
  ] = await Promise.all([
    allByFamily(
      db,
      "SELECT id, name, color, relation, birthday, linked_user_id AS linkedUserId FROM family_members WHERE family_id = ?",
      familyId,
    ),
    db
      .prepare(
        `SELECT users.id AS userId, users.email AS email, users.name AS name,
                family_memberships.role AS role, family_memberships.joined_at AS joinedAt
         FROM family_memberships
         JOIN users ON users.id = family_memberships.user_id
         WHERE family_memberships.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(db, "SELECT * FROM tasks WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM task_routines WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM shopping_lists WHERE family_id = ?", familyId),
    db
      .prepare(
        `SELECT shopping_list_items.* FROM shopping_list_items
         JOIN shopping_lists ON shopping_lists.id = shopping_list_items.list_id
         WHERE shopping_lists.family_id = ?`,
      )
      .bind(familyId)
      .all<Record<string, unknown>>()
      .then((r) => r.results),
    allByFamily(db, "SELECT * FROM shopping_list_templates WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM meal_plan_entries WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM birthday_gift_plans WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM shared_expenses WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM shared_expense_settlements WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM allowance_ledger WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM calendar_member_mappings WHERE family_id = ?", familyId),
    // url gemmes bevidst i klartekst (se filens header-kommentar) — SELECT *
    // er derfor sikkert her, i modsætning til icloud_calendar_connections.
    allByFamily(db, "SELECT * FROM ics_calendar_subscriptions WHERE family_id = ?", familyId),
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
    allByFamily(db, "SELECT * FROM family_share_links WHERE family_id = ?", familyId),
    allByFamily(db, "SELECT * FROM family_enabled_features WHERE family_id = ?", familyId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    scope: "family",
    family: family ?? null,
    members,
    memberships,
    tasks,
    taskRoutines,
    shoppingLists,
    shoppingListItems,
    shoppingListTemplates,
    mealPlanEntries,
    birthdayGiftPlans,
    sharedExpenses,
    sharedExpenseSettlements,
    allowanceLedger,
    calendarMemberMappings,
    icsCalendarSubscriptions,
    icloudCalendarConnections,
    familyShareLinks,
    familyEnabledFeatures,
  };
}
