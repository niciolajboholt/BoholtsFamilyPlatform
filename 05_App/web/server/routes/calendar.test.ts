import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

vi.mock("../lib/googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

const { getGoogleAccessToken, GoogleNotConnectedError } = await import("../lib/googleConnection");
const { default: calendarRoutes } = await import("./calendar");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);

describe("calendar routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
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
    );

    expect(response.status).toBe(204);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/nicolaj%40example.com/events/abc123",
    );
    expect(calledInit.method).toBe("DELETE");
  });
});
