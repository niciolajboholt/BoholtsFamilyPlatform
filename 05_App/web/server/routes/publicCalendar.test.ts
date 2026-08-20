import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("../lib/googleCalendarAggregation", () => ({
  fetchPublicFamilyCalendarEvents: vi.fn(),
}));

const { fetchPublicFamilyCalendarEvents } = await import("../lib/googleCalendarAggregation");
const { GoogleNotConnectedError } = await import("../lib/googleConnection");
const { default: publicCalendarRoutes } = await import("./publicCalendar");

const fetchPublicFamilyCalendarEventsMock = vi.mocked(fetchPublicFamilyCalendarEvents);

async function seedShareLink(
  env: ReturnType<typeof createFakeEnv>,
  overrides: {
    token?: string;
    revokedAt?: string | null;
    includeDescription?: boolean;
    includeLocation?: boolean;
  } = {},
): Promise<string> {
  await seedUser(env.DB as never, { id: "creator" });
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind("family-1", "Boholt", "creator", new Date().toISOString())
    .run();

  const token = overrides.token ?? "a-very-long-share-token";

  await env.DB.prepare(
    `INSERT INTO family_share_links
       (id, family_id, token, created_by_user_id, included_member_ids, include_description, include_location, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      "link-1",
      "family-1",
      token,
      "creator",
      "member-1,member-2",
      overrides.includeDescription ? 1 : 0,
      overrides.includeLocation ? 1 : 0,
      new Date().toISOString(),
      overrides.revokedAt ?? null,
    )
    .run();

  return token;
}

describe("GET /family-calendar/:token", () => {
  beforeEach(() => {
    fetchPublicFamilyCalendarEventsMock.mockReset();
  });

  it("returns 404 for a token that does not exist", async () => {
    const env = createFakeEnv();

    const response = await publicCalendarRoutes.request("/family-calendar/does-not-exist", {}, env);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a revoked token", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env, { revokedAt: new Date().toISOString() });

    const response = await publicCalendarRoutes.request(`/family-calendar/${token}`, {}, env);

    expect(response.status).toBe(404);
  });

  it("returns the family name and events for a valid token, without requiring a session", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([
      {
        title: "Fødselsdag",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);

    const response = await publicCalendarRoutes.request(`/family-calendar/${token}`, {}, env);
    const body = await response.json<{ familyName: string; events: unknown[] }>();

    expect(response.status).toBe(200);
    expect(body.familyName).toBe("Boholt");
    expect(body.events).toHaveLength(1);
    expect(fetchPublicFamilyCalendarEventsMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "creator",
      ["member-1", "member-2"],
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    );
  });

  it("strips description and location by default", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([
      {
        title: "Lægebesøg",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        description: "Kontrol hos speciallæge",
        location: "Privatadresse 12",
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);

    const response = await publicCalendarRoutes.request(`/family-calendar/${token}`, {}, env);
    const body = await response.json<{ events: { description?: string; location?: string }[] }>();

    expect(body.events[0].description).toBeUndefined();
    expect(body.events[0].location).toBeUndefined();
  });

  it("includes description and location when the share link opts in", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env, { includeDescription: true, includeLocation: true });
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([
      {
        title: "Lægebesøg",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        description: "Kontrol hos speciallæge",
        location: "Privatadresse 12",
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);

    const response = await publicCalendarRoutes.request(`/family-calendar/${token}`, {}, env);
    const body = await response.json<{ events: { description?: string; location?: string }[] }>();

    expect(body.events[0].description).toBe("Kontrol hos speciallæge");
    expect(body.events[0].location).toBe("Privatadresse 12");
  });

  it("returns 503 when the creator's Google connection is gone", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockRejectedValue(new GoogleNotConnectedError());

    const response = await publicCalendarRoutes.request(`/family-calendar/${token}`, {}, env);

    expect(response.status).toBe(503);
  });

  it("rejects further requests from the same visitor after too many within the window", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([]);

    let lastResponse: Response | undefined;
    for (let i = 0; i < 31; i++) {
      lastResponse = await publicCalendarRoutes.request(
        `/family-calendar/${token}`,
        { headers: { "cf-connecting-ip": "203.0.113.1" } },
        env,
      );
    }

    expect(lastResponse?.status).toBe(429);
  });

  it("does not let one visitor's usage exhaust the quota for a different visitor on the same link", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([]);

    for (let i = 0; i < 25; i++) {
      await publicCalendarRoutes.request(
        `/family-calendar/${token}`,
        { headers: { "cf-connecting-ip": "203.0.113.1" } },
        env,
      );
    }

    const otherVisitorResponse = await publicCalendarRoutes.request(
      `/family-calendar/${token}`,
      { headers: { "cf-connecting-ip": "203.0.113.2" } },
      env,
    );

    expect(otherVisitorResponse.status).toBe(200);
  });

  it("still rejects once the coarser per-token ceiling is reached, even across many visitors", async () => {
    const env = createFakeEnv();
    const token = await seedShareLink(env);
    fetchPublicFamilyCalendarEventsMock.mockResolvedValue([]);

    // Simulerer at loftet på 300/time allerede er nået (i stedet for at
    // rulle 300 rigtige requests igennem) — det er selve
    // per-token-loftets adfærd, der testes her, ikke checkRateLimit()'s
    // egen tælling (dækket af rateLimit.test.ts).
    const now = new Date().toISOString();
    for (let i = 0; i < 300; i++) {
      await env.DB.prepare(
        "INSERT INTO rate_limit_attempts (scope, key, created_at) VALUES (?, ?, ?)",
      )
        .bind("public-family-calendar", token, now)
        .run();
    }

    const response = await publicCalendarRoutes.request(
      `/family-calendar/${token}`,
      { headers: { "cf-connecting-ip": "203.0.113.99" } },
      env,
    );

    expect(response.status).toBe(429);
  });
});
