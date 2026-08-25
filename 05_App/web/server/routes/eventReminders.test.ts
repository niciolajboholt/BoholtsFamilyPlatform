import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";
import { encodeGoogleEventId } from "../lib/googleEventIds";

vi.mock("../lib/googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

const { getGoogleAccessToken } = await import("../lib/googleConnection");
const { default: eventReminders } = await import("./eventReminders");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);

const calendarId = "primary";

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  ownerUserId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", ownerUserId, now)
    .run();

  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(familyId, ownerUserId, now)
    .run();
}

describe("event reminder routes", () => {
  let env: ReturnType<typeof createFakeEnv>;
  const fetchMock = vi.fn();

  beforeEach(() => {
    env = createFakeEnv();
    getGoogleAccessTokenMock.mockReset().mockResolvedValue("access-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects any request without a session cookie", async () => {
    const eventId = encodeGoogleEventId(calendarId, "evt-1");
    const response = await eventReminders.request(`/family-1/event-reminders/${eventId}`, {}, env);
    expect(response.status).toBe(401);
  });

  it("returns 404 for a family the user does not belong to", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "outsider" });
    const eventId = encodeGoogleEventId(calendarId, "evt-1");

    const response = await eventReminders.request(
      `/some-other-family/event-reminders/${eventId}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("rejects an invalid offsetMinutes value", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    const eventId = encodeGoogleEventId(calendarId, "evt-1");
    const response = await eventReminders.request(
      `/family-1/event-reminders/${eventId}`,
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ offsetMinutes: 7 }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("sets a reminder on a non-recurring event and returns it via GET", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "evt-1", summary: "Padelkamp" }), { status: 200 }),
    );

    const eventId = encodeGoogleEventId(calendarId, "evt-1");

    const putResponse = await eventReminders.request(
      `/family-1/event-reminders/${eventId}`,
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ offsetMinutes: 30 }),
      },
      env,
    );
    const putBody: { reminder: { offsetMinutes: number } } = await putResponse.json();

    expect(putResponse.status).toBe(200);
    expect(putBody.reminder.offsetMinutes).toBe(30);

    const getResponse = await eventReminders.request(
      `/family-1/event-reminders/${eventId}`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const getBody: { reminder: { offsetMinutes: number } | null } = await getResponse.json();

    expect(getBody.reminder).toEqual({ offsetMinutes: 30 });
  });

  it("stores a reminder set on a recurring instance against the series' own id", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    // Instansens eget id ("birthday-series_20260919") har et
    // recurringEventId, der peger på selve rækken.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "birthday-series_20260919",
          recurringEventId: "birthday-series",
          summary: "Børnefødselsdag",
        }),
        { status: 200 },
      ),
    );

    const instanceEventId = encodeGoogleEventId(calendarId, "birthday-series_20260919");

    await eventReminders.request(
      `/family-1/event-reminders/${instanceEventId}`,
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ offsetMinutes: 3 * 24 * 60 }),
      },
      env,
    );

    const stored = await env.DB.prepare("SELECT event_id AS eventId FROM event_reminders WHERE family_id = ?")
      .bind("family-1")
      .first<{ eventId: string }>();

    expect(stored?.eventId).toBe(encodeGoogleEventId(calendarId, "birthday-series"));
  });

  it("deletes a reminder", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", userId);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "evt-1", summary: "Padelkamp" }), { status: 200 }),
    );

    const eventId = encodeGoogleEventId(calendarId, "evt-1");

    await eventReminders.request(
      `/family-1/event-reminders/${eventId}`,
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ offsetMinutes: 30 }),
      },
      env,
    );

    const deleteResponse = await eventReminders.request(
      `/family-1/event-reminders/${eventId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    const deleteBody: { reminder: null } = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.reminder).toBeNull();

    const remaining = await env.DB.prepare("SELECT * FROM event_reminders WHERE family_id = ?")
      .bind("family-1")
      .all();
    expect(remaining.results).toHaveLength(0);
  });
});
