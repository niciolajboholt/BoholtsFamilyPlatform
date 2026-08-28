import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";
import { encodeGoogleEventId } from "./googleEventIds";

vi.mock("./googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

vi.mock("./pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pushNotifications")>();
  return { ...actual, sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined) };
});

const { getGoogleAccessToken, GoogleNotConnectedError } = await import("./googleConnection");
const { sendPushNotificationToFamily } = await import("./pushNotifications");
const { sendDueEventReminders } = await import("./eventReminders");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);
const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);

const calendarId = "primary";
const now = new Date("2026-09-16T10:00:00.000Z");

async function seedFamily(env: ReturnType<typeof createFakeEnv>, familyId = "family-1"): Promise<void> {
  await seedUser(env.DB as never, { id: "owner" });
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", "owner", new Date().toISOString())
    .run();
}

async function insertReminder(
  env: ReturnType<typeof createFakeEnv>,
  options: {
    id?: string;
    familyId?: string;
    eventId: string;
    offsetMinutes: number;
    lastSentOccurrenceStart?: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO event_reminders
       (id, family_id, event_id, offset_minutes, created_by_user_id, created_at, last_sent_occurrence_start)
     VALUES (?, ?, ?, ?, 'owner', ?, ?)`,
  )
    .bind(
      options.id ?? crypto.randomUUID(),
      options.familyId ?? "family-1",
      options.eventId,
      options.offsetMinutes,
      new Date().toISOString(),
      options.lastSentOccurrenceStart ?? null,
    )
    .run();
}

describe("sendDueEventReminders", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset().mockResolvedValue("access-token");
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a push and records the occurrence when a one-off event's reminder is due", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const eventId = encodeGoogleEventId(calendarId, "evt-1");
    await insertReminder(env, { eventId, offsetMinutes: 20 });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "evt-1",
          summary: "Kørsel til padelkamp",
          // 20 min før dette (10:22) lander på 10:02 — inden for det aktuelle
          // 5-minutters vindue [now=10:00, now+5min=10:05).
          start: { dateTime: "2026-09-16T10:22:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    await sendDueEventReminders(env, now);

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "",
      expect.objectContaining({ body: expect.stringContaining("Kørsel til padelkamp") }),
    );

    const row = await env.DB.prepare(
      "SELECT last_sent_occurrence_start AS lastSent FROM event_reminders WHERE event_id = ?",
    )
      .bind(eventId)
      .first<{ lastSent: string }>();
    expect(row?.lastSent).toBe("2026-09-16T10:22:00.000Z");
  });

  it("does not send when the reminder time has not been reached yet", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const eventId = encodeGoogleEventId(calendarId, "evt-1");
    await insertReminder(env, { eventId, offsetMinutes: 20 });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "evt-1",
          summary: "Om en time",
          start: { dateTime: "2026-09-16T11:15:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    await sendDueEventReminders(env, now);

    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("never includes a private event title in a reminder push", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const eventId = encodeGoogleEventId(calendarId, "private-event");
    await insertReminder(env, { eventId, offsetMinutes: 20 });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "private-event",
          visibility: "private",
          summary: "Fortrolig behandling",
          start: { dateTime: "2026-09-16T10:22:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    await sendDueEventReminders(env, now);

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "",
      expect.objectContaining({ body: "En privat aftale er om 20 minutter." }),
    );
    expect(JSON.stringify(sendPushNotificationToFamilyMock.mock.calls)).not.toContain(
      "Fortrolig behandling",
    );
  });

  it("does not re-send for an occurrence already recorded", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    const eventId = encodeGoogleEventId(calendarId, "evt-1");
    await insertReminder(env, {
      eventId,
      offsetMinutes: 20,
      lastSentOccurrenceStart: "2026-09-16T10:15:00.000Z",
    });

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "evt-1",
          summary: "Allerede påmindt",
          start: { dateTime: "2026-09-16T10:15:00.000Z" },
        }),
        { status: 200 },
      ),
    );

    await sendDueEventReminders(env, now);

    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("resolves the next occurrence for a recurring event via the instances endpoint", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    // Gemt mod selve rækkens id (masteren), som eventReminders-ruten altid
    // gør for en gentagende aftale.
    const eventId = encodeGoogleEventId(calendarId, "birthday-series");
    await insertReminder(env, { eventId, offsetMinutes: 3 * 24 * 60 });

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.includes("/instances")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "birthday-series_20260919",
                  summary: "Børnefødselsdag",
                  start: { date: "2026-09-19" },
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: "birthday-series",
            summary: "Børnefødselsdag",
            recurrence: ["RRULE:FREQ=YEARLY"],
            start: { date: "2026-09-19" },
          }),
          { status: 200 },
        ),
      );
    });

    // 3 dage før midnat 19/9 lokal (Europe/Copenhagen, se
    // vite.config.ts's setupTimezone.ts) = midnat 16/9 lokal, som i UTC
    // (CEST, +2) er 2026-09-15T22:00:00.000Z.
    const remindWindowNow = new Date("2026-09-15T22:00:00.000Z");

    await sendDueEventReminders(env, remindWindowNow);

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      "",
      expect.objectContaining({ body: expect.stringContaining("Børnefødselsdag") }),
    );
  });

  it("does not throw when the family has no Google connection", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await insertReminder(env, { eventId: encodeGoogleEventId(calendarId, "evt-1"), offsetMinutes: 20 });
    getGoogleAccessTokenMock.mockRejectedValue(new GoogleNotConnectedError());

    await expect(sendDueEventReminders(env, now)).resolves.toBeUndefined();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });

  it("skips silently when the event can no longer be found on Google", async () => {
    const env = createFakeEnv();
    await seedFamily(env);
    await insertReminder(env, { eventId: encodeGoogleEventId(calendarId, "evt-deleted"), offsetMinutes: 20 });
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    await expect(sendDueEventReminders(env, now)).resolves.toBeUndefined();
    expect(sendPushNotificationToFamilyMock).not.toHaveBeenCalled();
  });
});
