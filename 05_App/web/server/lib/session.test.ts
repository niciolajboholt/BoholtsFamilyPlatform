import { describe, expect, it } from "vitest";

import { cleanupExpiredSessions } from "./session";
import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

describe("cleanupExpiredSessions", () => {
  it("sletter kun udløbne sessioner, ikke gyldige", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });

    const now = new Date();
    const expired = new Date(now.getTime() - 60 * 60 * 1000);
    const stillValid = new Date(now.getTime() + 60 * 60 * 1000);

    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
      .bind("expired-session", "user-1", now.toISOString(), expired.toISOString())
      .run();
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
      .bind("valid-session", "user-1", now.toISOString(), stillValid.toISOString())
      .run();

    await cleanupExpiredSessions(env);

    const remaining = await env.DB.prepare("SELECT id FROM sessions ORDER BY id").all<{
      id: string;
    }>();

    expect(remaining.results.map((row) => row.id)).toEqual(["valid-session"]);
  });

  it("er en no-op når der ingen udløbne sessioner er", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });

    const stillValid = new Date(Date.now() + 60 * 60 * 1000);
    await env.DB.prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
      .bind("valid-session", "user-1", new Date().toISOString(), stillValid.toISOString())
      .run();

    await cleanupExpiredSessions(env);

    const remaining = await env.DB.prepare("SELECT id FROM sessions").all<{ id: string }>();
    expect(remaining.results).toHaveLength(1);
  });
});
