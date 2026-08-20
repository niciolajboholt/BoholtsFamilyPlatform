import { describe, expect, it } from "vitest";

import { createFakeEnv } from "./testing/fakeEnv";
import worker from "./index";

const fakeExecutionCtx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

function request(path: string): Promise<Response> {
  return Promise.resolve(
    worker.fetch(new Request(`http://localhost${path}`), createFakeEnv(), fakeExecutionCtx),
  );
}

describe("index (top-level Worker)", () => {
  it("returns a JSON 404 for an unknown /api/* path, not the SPA fallback", async () => {
    const response = await request("/api/not-a-real-endpoint");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const body: { error: string } = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("still falls through to the SPA for an unknown non-API path", async () => {
    const response = await request("/some-page-the-router-handles");
    const text = await response.text();

    expect(text).toBe("not used in tests");
  });

  it("sets security headers on every response", async () => {
    const response = await request("/api/health");

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("GET /api/health reports schema status alongside db connectivity", async () => {
    const response = await request("/api/health");
    const body: { status: string; db: boolean; migrations: { ok: boolean } } =
      await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
    expect(body.migrations.ok).toBe(true);
  });
});
