// Test-only D1-erstatning, drevet af Node's indbyggede SQLite (node:sqlite,
// Node 22+) og de rigtige migrationsfiler — så ruter testes mod ægte
// SQL-semantik i stedet for en håndrullet forespørgsels-matcher. D1 er selv
// SQLite-kompatibel, så dette er en tro nok stand-in til rute-/enhedstests.
// Bruges aldrig i den kørende Worker.

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationFiles = [
  "0001_init.sql",
  "0002_auth.sql",
  "0003_families.sql",
  "0004_calendar_member_mappings.sql",
  "0005_push_subscriptions.sql",
  "0006_shopping_lists.sql",
  "0007_shopping_list_types.sql",
  "0008_tasks.sql",
  "0009_rate_limits.sql",
  "0010_family_share_links.sql",
  "0011_task_reminders.sql",
  "0012_weekly_summaries.sql",
  "0013_share_link_field_toggles.sql",
  "0014_feedback.sql",
];

function loadMigrations(db: DatabaseSync): void {
  for (const file of migrationFiles) {
    const path = fileURLToPath(new URL(`../migrations/${file}`, import.meta.url));
    db.exec(readFileSync(path, "utf-8"));
  }
}

export interface FakeBoundStatement {
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: true }>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface FakeD1 {
  prepare(sql: string): FakeBoundStatement & {
    bind(...args: unknown[]): FakeBoundStatement;
  };
  batch(statements: FakeBoundStatement[]): Promise<unknown[]>;
}

function bind(db: DatabaseSync, sql: string, args: unknown[]): FakeBoundStatement {
  return {
    async first<T>(): Promise<T | null> {
      const row = db.prepare(sql).get(...(args as never[]));
      return (row as T | undefined) ?? null;
    },
    async run(): Promise<{ success: true }> {
      db.prepare(sql).run(...(args as never[]));
      return { success: true };
    },
    async all<T>(): Promise<{ results: T[] }> {
      const rows = db.prepare(sql).all(...(args as never[]));
      return { results: rows as T[] };
    },
  };
}

// Opretter en frisk, isoleret in-memory database pr. kald — hver test skal
// starte sit eget kald af denne, aldrig deles på tværs af tests.
export function createFakeD1(): FakeD1 {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  loadMigrations(db);

  return {
    prepare(sql: string) {
      // Understøtter både `.prepare(sql).bind(...).run()` (den almindelige
      // vej i ruterne) og et direkte `.prepare(sql).run()` uden binds.
      return { ...bind(db, sql, []), bind: (...args: unknown[]) => bind(db, sql, args) };
    },
    async batch(statements: FakeBoundStatement[]) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
  };
}

interface SeedUserOptions {
  id: string;
  googleSub?: string;
  email?: string;
  name?: string;
  pictureUrl?: string | null;
}

export async function seedUser(db: FakeD1, options: SeedUserOptions): Promise<void> {
  await db
    .prepare(
      "INSERT INTO users (id, google_sub, email, name, picture_url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      options.id,
      options.googleSub ?? `google-${options.id}`,
      options.email ?? `${options.id}@example.com`,
      options.name ?? options.id,
      options.pictureUrl ?? null,
      new Date().toISOString(),
    )
    .run();
}

// Sår en bruger + en gyldig session, og returnerer det Cookie-header-værdi
// en test kan sende med for at optræde som denne bruger.
export async function seedLoggedInUser(
  db: FakeD1,
  options: SeedUserOptions,
): Promise<{ userId: string; cookieHeader: string }> {
  await seedUser(db, options);

  const sessionId = `session-${options.id}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(sessionId, options.id, now.toISOString(), expiresAt.toISOString())
    .run();

  return { userId: options.id, cookieHeader: `session=${sessionId}` };
}
