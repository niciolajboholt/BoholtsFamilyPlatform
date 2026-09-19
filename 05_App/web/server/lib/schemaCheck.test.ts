import { describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { checkSchema } from "./schemaCheck";

describe("checkSchema", () => {
  it("reports ok with no missing tables or columns on a fully migrated database", async () => {
    const env = createFakeEnv();

    const result = await checkSchema(env.DB);

    expect(result).toEqual({ ok: true, missingTables: [], missingColumns: [] });
  });

  it("detects a missing table", async () => {
    const env = createFakeEnv();
    await env.DB.prepare("DROP TABLE tasks").run();

    const result = await checkSchema(env.DB);

    expect(result.ok).toBe(false);
    expect(result.missingTables).toContain("tasks");
  });

  it("detects a missing column on a table that otherwise exists", async () => {
    const env = createFakeEnv();
    await env.DB.prepare("ALTER TABLE tasks DROP COLUMN reminded_at").run();

    const result = await checkSchema(env.DB);

    expect(result.ok).toBe(false);
    expect(result.missingTables).toEqual([]);
    expect(result.missingColumns).toContain("tasks.reminded_at");
  });

  it("does not report a column as missing when its table is already missing", async () => {
    const env = createFakeEnv();
    await env.DB.prepare("DROP TABLE tasks").run();

    const result = await checkSchema(env.DB);

    expect(result.missingTables).toContain("tasks");
    expect(result.missingColumns).toEqual([]);
  });

  it("detects a missing Sprint 50 deletion_requests table", async () => {
    const env = createFakeEnv();
    await env.DB.prepare("DROP TABLE deletion_requests").run();

    const result = await checkSchema(env.DB);

    expect(result.ok).toBe(false);
    expect(result.missingTables).toContain("deletion_requests");
  });

  it.each([
    ["users", "deleted_at"],
    ["families", "deleted_at"],
    ["sessions", "reauthenticated_at"],
  ])("detects a missing Sprint 50 column %s.%s", async (table, column) => {
    const env = createFakeEnv();
    await env.DB.prepare(`ALTER TABLE ${table} DROP COLUMN ${column}`).run();

    const result = await checkSchema(env.DB);

    expect(result.ok).toBe(false);
    expect(result.missingColumns).toContain(`${table}.${column}`);
  });
});
