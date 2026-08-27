import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

vi.mock("../lib/googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return { ...actual, sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined) };
});

const { getGoogleAccessToken, GoogleNotConnectedError } = await import("../lib/googleConnection");
const { sendPushNotificationToFamily } = await import("../lib/pushNotifications");
const { default: calendarRoutes } = await import("./calendar");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);
const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);

// c.executionCtx.waitUntil() throws "This context has no ExecutionContext"
// unless a real (or fake) ExecutionContext is passed to .request() — real
// Workers always provide one, but Hono's test helper doesn't by default.
// The task is captured (not just discarded) so tests can await it — a real
// waitUntil() deliberately doesn't block the response, but a test needs to
// know the background work has actually settled before asserting on it.
let lastWaitUntilTask: Promise<unknown> | undefined;
const fakeExecutionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    lastWaitUntilTask = promise;
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

describe("calendar routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset();
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    lastWaitUntilTask = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects any request without a session cookie", async () => {
    const env = createFakeEnv();

    const response = await calendarRoutes.request("/status", {}, env);

    expect(response.status).toBe(401);
  });

  it("/status reports not connected when there is no google_connections row", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });

    const response = await calendarRoutes.request("/status", { headers: { Cookie: cookieHeader } }, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false });
  });

  it("/status reports connected once a google_connections row exists", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    await env.DB.prepare(
      "INSERT INTO google_connections (user_id, encrypted_refresh_token, scope, connected_at) VALUES (?, ?, ?, ?)",
    )
      .bind("user-1", "irrelevant-for-this-test", "calendar.events", new Date().toISOString())
      .run();

    const response = await calendarRoutes.request("/status", { headers: { Cookie: cookieHeader } }, env);

    expect(await response.json()).toEqual({ connected: true });
  });

  it("returns 401 when Google was never connected", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    getGoogleAccessTokenMock.mockRejectedValue(new GoogleNotConnectedError());

    const response = await calendarRoutes.request(
      "/calendars",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(401);
  });

  it("proxies GET /calendars to Google's calendarList endpoint with the access token", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: "primary" }] }), { status: 200 }),
    );

    const response = await calendarRoutes.request(
      "/calendars",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ id: "primary" }] });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    );
    expect(calledInit.headers.Authorization).toBe("Bearer access-token-123");
  });

  it("forwards event creation body and URL-encodes the calendar id", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "new-event" }), { status: 201 }),
    );

    const eventBody = { summary: "Tandlæge", start: { dateTime: "2026-08-20T10:00:00+02:00" } };

    const response = await calendarRoutes.request(
      "/calendars/nicolaj%40example.com/events",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody),
      },
      env,
      fakeExecutionCtx,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "new-event" });

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/nicolaj%40example.com/events",
    );
    expect(calledInit.method).toBe("POST");
    expect(JSON.parse(calledInit.body as string)).toEqual(eventBody);
  });

  it("proxies event deletion with the correct method and path, passing the status code through", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const response = await calendarRoutes.request(
      "/calendars/nicolaj%40example.com/events/abc123",
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
      fakeExecutionCtx,
    );

    expect(response.status).toBe(204);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/nicolaj%40example.com/events/abc123",
    );
    expect(calledInit.method).toBe("DELETE");
  });

  describe("push-notifikation ved kalender-ændringer (Sprint 21, Del A fortsat)", () => {
    async function seedFamily(
      env: ReturnType<typeof createFakeEnv>,
      actorUserId: string,
    ): Promise<void> {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
      )
        .bind("family-1", "Boholt", actorUserId, now)
        .run();
      await env.DB.prepare(
        "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
      )
        .bind("family-1", actorUserId, "owner", now)
        .run();
    }

    it("notifies the family (excluding the actor) when an event is created", async () => {
      const env = createFakeEnv();
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
      await seedFamily(env, "user-1");
      getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ id: "new-event", summary: "Tandlæge" }), { status: 201 }),
      );

      await calendarRoutes.request(
        "/calendars/nicolaj%40example.com/events",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: "Tandlæge" }),
        },
        env,
        fakeExecutionCtx,
      );
      await lastWaitUntilTask;

      expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
        env,
        "family-1",
        "user-1",
        expect.objectContaining({ body: expect.stringContaining("Tandlæge") }),
      );
    });

    it("does not notify when the actor belongs to no family", async () => {
      const env = createFakeEnv();
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
      getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "new-event" }), { status: 201 }));

      await calendarRoutes.request(
        "/calendars/nicolaj%40example.com/events",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: "Tandlæge" }),
        },
        env,
        fakeExecutionCtx,
      );
      await lastWaitUntilTask;

      expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
    });

    it("never includes a private event title in the family push", async () => {
      const env = createFakeEnv();
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
      await seedFamily(env, "user-1");
      getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "private-event",
            summary: "Fortrolig behandling",
            visibility: "private",
          }),
          { status: 201 },
        ),
      );

      await calendarRoutes.request(
        "/calendars/nicolaj%40example.com/events",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: "Fortrolig behandling", visibility: "private" }),
        },
        env,
        fakeExecutionCtx,
      );
      await lastWaitUntilTask;

      expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
        env,
        "family-1",
        "user-1",
        expect.objectContaining({ body: "En privat aftale er tilføjet til kalenderen." }),
      );
      expect(JSON.stringify(sendPushNotificationToFamilyMock.mock.calls)).not.toContain(
        "Fortrolig behandling",
      );
    });

    it("does not notify when the Google request itself failed", async () => {
      const env = createFakeEnv();
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
      await seedFamily(env, "user-1");
      getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 400 }));

      await calendarRoutes.request(
        "/calendars/nicolaj%40example.com/events",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ summary: "Tandlæge" }),
        },
        env,
        fakeExecutionCtx,
      );

      expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
    });

    it("notifies the family with a generic message when an event is deleted", async () => {
      const env = createFakeEnv();
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
      await seedFamily(env, "user-1");
      getGoogleAccessTokenMock.mockResolvedValue("access-token-123");
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await calendarRoutes.request(
        "/calendars/nicolaj%40example.com/events/abc123",
        { method: "DELETE", headers: { Cookie: cookieHeader } },
        env,
        fakeExecutionCtx,
      );
      await lastWaitUntilTask;

      expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
        env,
        "family-1",
        "user-1",
        expect.objectContaining({ title: "Aftale slettet" }),
      );
    });
  });
});
