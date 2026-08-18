import { describe, expect, it } from "vitest";

import { checkRateLimit, cleanupOldRateLimitAttempts } from "./rateLimit";
import { createFakeEnv } from "../testing/fakeEnv";

describe("checkRateLimit", () => {
  it("tillader forsøg under grænsen og afviser derefter", async () => {
    const env = createFakeEnv();
    const options = { scope: "test", key: "user-1", maxAttempts: 3, windowMs: 60_000 };

    expect((await checkRateLimit(env.DB, options)).allowed).toBe(true);
    expect((await checkRateLimit(env.DB, options)).allowed).toBe(true);
    expect((await checkRateLimit(env.DB, options)).allowed).toBe(true);
    expect((await checkRateLimit(env.DB, options)).allowed).toBe(false);
  });

  it("holder forskellige nøgler adskilt", async () => {
    const env = createFakeEnv();
    const optionsFor = (key: string) => ({
      scope: "test",
      key,
      maxAttempts: 1,
      windowMs: 60_000,
    });

    expect((await checkRateLimit(env.DB, optionsFor("user-1"))).allowed).toBe(true);
    expect((await checkRateLimit(env.DB, optionsFor("user-1"))).allowed).toBe(false);
    expect((await checkRateLimit(env.DB, optionsFor("user-2"))).allowed).toBe(true);
  });

  it("holder forskellige scopes adskilt", async () => {
    const env = createFakeEnv();
    const optionsFor = (scope: string) => ({
      scope,
      key: "user-1",
      maxAttempts: 1,
      windowMs: 60_000,
    });

    expect((await checkRateLimit(env.DB, optionsFor("scope-a"))).allowed).toBe(true);
    expect((await checkRateLimit(env.DB, optionsFor("scope-a"))).allowed).toBe(false);
    expect((await checkRateLimit(env.DB, optionsFor("scope-b"))).allowed).toBe(true);
  });
});

describe("cleanupOldRateLimitAttempts", () => {
  it("sletter kun forsøg ældre end 24 timer", async () => {
    const env = createFakeEnv();
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();

    await env.DB.prepare(
      "INSERT INTO rate_limit_attempts (scope, key, created_at) VALUES (?, ?, ?)",
    )
      .bind("test", "user-1", old)
      .run();
    await env.DB.prepare(
      "INSERT INTO rate_limit_attempts (scope, key, created_at) VALUES (?, ?, ?)",
    )
      .bind("test", "user-1", recent)
      .run();

    await cleanupOldRateLimitAttempts(env.DB);

    const remaining = await env.DB.prepare("SELECT created_at FROM rate_limit_attempts").all<{
      created_at: string;
    }>();
    expect(remaining.results).toEqual([{ created_at: recent }]);
  });
});
