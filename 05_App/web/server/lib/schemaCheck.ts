// Sprint 29: gør en manglende/delvist kørt migration synlig med det
// samme via /api/health, i stedet for først når en rute fejler i
// produktion. Manuel migration er stadig bevidst fastholdt (se
// 09_Lessons_Learned.md) — dette erstatter blot den manuelle
// `SELECT name FROM sqlite_master`-verifikation med ét endpoint-kald.
//
// Listerne herunder skal holdes i sync med server/migrations/ — der er
// bevidst ingen automatisk udledning fra migrationsfilerne selv, da
// formålet netop er at opdage, hvis den FAKTISKE database afviger fra
// hvad koden forventer, ikke fra hvad migrationsfilerne siger.

const expectedTables = [
  "users",
  "sessions",
  "google_connections",
  "families",
  "family_memberships",
  "family_invites",
  "family_members",
  "calendar_member_mappings",
  "push_subscriptions",
  "shopping_lists",
  "shopping_list_items",
  "shopping_item_category_overrides",
  "shopping_list_templates",
  "shopping_list_template_items",
  "task_routines",
  "task_routine_items",
  "tasks",
  "rate_limit_attempts",
  "family_share_links",
  "family_weekly_summaries",
  "feedback",
  "event_reminders",
] as const;

// Kolonner tilføjet via ALTER TABLE på en allerede eksisterende tabel —
// kan mangle, selvom selve tabellen findes (præcis den slags delvise
// migrationstilstand, der tidligere gav en incident).
const expectedColumns = [
  { table: "shopping_lists", column: "type" },
  { table: "tasks", column: "reminded_at" },
  { table: "family_share_links", column: "include_description" },
  { table: "family_share_links", column: "include_location" },
] as const;

export interface SchemaCheckResult {
  ok: boolean;
  missingTables: string[];
  missingColumns: string[];
}

export async function checkSchema(db: D1Database): Promise<SchemaCheckResult> {
  const { results: tables } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all<{ name: string }>();
  const existingTableNames = new Set(tables.map((table) => table.name));

  const missingTables = expectedTables.filter((table) => !existingTableNames.has(table));

  const missingColumns: string[] = [];

  for (const { table, column } of expectedColumns) {
    // En manglende tabel er allerede rapporteret ovenfor — undgå at
    // forespørge en tabel, der slet ikke findes.
    if (!existingTableNames.has(table)) {
      continue;
    }

    const { results: columns } = await db
      .prepare("SELECT name FROM pragma_table_info(?)")
      .bind(table)
      .all<{ name: string }>();

    if (!columns.some((existingColumn) => existingColumn.name === column)) {
      missingColumns.push(`${table}.${column}`);
    }
  }

  return {
    ok: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  };
}
