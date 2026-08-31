import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("./googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

const { getGoogleAccessToken, GoogleNotConnectedError } = await import("./googleConnection");
const { syncCalendarActivity, cleanupOldCalendarActivity } = await import("./calendarActivitySync");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);

const now = new Date("2026-09-16T10:00:00.000Z");
const calendarId = "primary";

async function seedFamilyWithCalendar(
  env: ReturnType<typeof createFakeEnv>,
  options: { familyId?: string; googleCalendarId?: string } = {},
): Promise<{ familyId: string; googleCalendarId: string }> {
  const familyId = options.familyId ?? "family-1";
  const googleCalendarId = options.googleCalendarId ?? calendarId;

  await seedUser(env.DB as never, { id: `owner-${familyId}` });
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", `owner-${familyId}`, new Date().toISOString())
    .run();

  await env.DB.prepare(
    "INSERT INTO family_members (id, family_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(`member-${familyId}`, familyId, "Nicolaj", "#2F6B4F", new Date().toISOString())
    .run();

  await env.DB.prepare(
    "INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id) VALUES (?, ?, ?)",
  )
    .bind(familyId, googleCalendarId, `member-${familyId}`)
    .run();

  return { familyId, googleCalendarId };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("syncCalendarActivity", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset().mockResolvedValue("access-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bootstraps a calendar with no saved syncToken: seeds snapshots but writes no activity", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          { id: "evt-1", summary: "Fødselsdag", start: { dateTime: "2026-09-20T10:00:00.000Z" }, end: { dateTime: "2026-09-20T11:00:00.000Z" } },
        ],
        nextSyncToken: "token-1",
      }),
    );

    await syncCalendarActivity(env, now);

    const activity = await env.DB.prepare("SELECT * FROM calendar_activity_log").all();
    expect(activity.results).toHaveLength(0);

    const snapshot = await env.DB.prepare(
      "SELECT safe_title AS safeTitle, is_private AS isPrivate FROM calendar_event_snapshots WHERE event_id = ?",
    )
      .bind("evt-1")
      .first<{ safeTitle: string; isPrivate: number }>();
    expect(snapshot).toEqual({ safeTitle: "Fødselsdag", isPrivate: 0 });

    const state = await env.DB.prepare(
      "SELECT sync_token AS syncToken FROM calendar_sync_state WHERE google_calendar_id = ?",
    )
      .bind(calendarId)
      .first<{ syncToken: string }>();
    expect(state?.syncToken).toBe("token-1");

    // Bootstrap-kaldet bruger tidsvindue, ikke syncToken.
    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.has("timeMin")).toBe(true);
    expect(requestedUrl.searchParams.has("syncToken")).toBe(false);
  });

  it("never stores the raw title of a private event, only the redacted one", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "evt-private",
            summary: "Terapisamtale",
            visibility: "private",
            start: { dateTime: "2026-09-20T10:00:00.000Z" },
            end: { dateTime: "2026-09-20T11:00:00.000Z" },
          },
        ],
        nextSyncToken: "token-1",
      }),
    );

    await syncCalendarActivity(env, now);

    const snapshot = await env.DB.prepare(
      "SELECT safe_title AS safeTitle, is_private AS isPrivate FROM calendar_event_snapshots WHERE event_id = ?",
    )
      .bind("evt-private")
      .first<{ safeTitle: string; isPrivate: number }>();
    expect(snapshot).toEqual({ safeTitle: "Optaget", isPrivate: 1 });

    const raw = await env.DB.prepare("SELECT * FROM calendar_event_snapshots WHERE safe_title = ?")
      .bind("Terapisamtale")
      .first();
    expect(raw).toBeNull();
  });

  it("classifies a delta sync's changes as created, moved, and cancelled", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    await env.DB.prepare(
      "INSERT INTO calendar_sync_state (google_calendar_id, family_id, sync_token, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(calendarId, "family-1", "old-token", new Date().toISOString())
      .run();

    await env.DB.prepare(
      "INSERT INTO calendar_event_snapshots (google_calendar_id, event_id, safe_title, is_private, start, end) VALUES (?, ?, ?, 0, ?, ?)",
    )
      .bind(calendarId, "evt-moved", "Svømning", "2026-09-20T14:00:00.000Z", "2026-09-20T15:00:00.000Z")
      .run();

    await env.DB.prepare(
      "INSERT INTO calendar_event_snapshots (google_calendar_id, event_id, safe_title, is_private, start, end) VALUES (?, ?, ?, 0, ?, ?)",
    )
      .bind(calendarId, "evt-cancelled", "Lægebesøg", "2026-09-16T09:00:00.000Z", "2026-09-16T10:00:00.000Z")
      .run();

    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          { id: "evt-new", summary: "Fødselsdag", start: { dateTime: "2026-09-22T10:00:00.000Z" }, end: { dateTime: "2026-09-22T11:00:00.000Z" } },
          { id: "evt-moved", summary: "Svømning", start: { dateTime: "2026-09-21T16:00:00.000Z" }, end: { dateTime: "2026-09-21T17:00:00.000Z" } },
          { id: "evt-cancelled", status: "cancelled" },
        ],
        nextSyncToken: "new-token",
      }),
    );

    await syncCalendarActivity(env, now);

    const { results: activity } = await env.DB.prepare(
      "SELECT change_type AS changeType, safe_title AS safeTitle, old_start AS oldStart, new_start AS newStart FROM calendar_activity_log ORDER BY change_type",
    ).all<{ changeType: string; safeTitle: string; oldStart: string | null; newStart: string | null }>();

    expect(activity).toEqual([
      { changeType: "cancelled", safeTitle: "Lægebesøg", oldStart: "2026-09-16T09:00:00.000Z", newStart: null },
      { changeType: "created", safeTitle: "Fødselsdag", oldStart: null, newStart: "2026-09-22T10:00:00.000Z" },
      {
        changeType: "moved",
        safeTitle: "Svømning",
        oldStart: "2026-09-20T14:00:00.000Z",
        newStart: "2026-09-21T16:00:00.000Z",
      },
    ]);

    const cancelledSnapshot = await env.DB.prepare(
      "SELECT event_id FROM calendar_event_snapshots WHERE event_id = ?",
    )
      .bind("evt-cancelled")
      .first();
    expect(cancelledSnapshot).toBeNull();

    const movedSnapshot = await env.DB.prepare("SELECT start FROM calendar_event_snapshots WHERE event_id = ?")
      .bind("evt-moved")
      .first<{ start: string }>();
    expect(movedSnapshot?.start).toBe("2026-09-21T16:00:00.000Z");

    // syncToken-kaldet bruger syncToken, ikke tidsvindue.
    const requestedUrl = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(requestedUrl.searchParams.get("syncToken")).toBe("old-token");
  });

  it("does not log a plain edit that leaves start/end unchanged", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    await env.DB.prepare(
      "INSERT INTO calendar_sync_state (google_calendar_id, family_id, sync_token, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(calendarId, "family-1", "old-token", new Date().toISOString())
      .run();

    await env.DB.prepare(
      "INSERT INTO calendar_event_snapshots (google_calendar_id, event_id, safe_title, is_private, start, end) VALUES (?, ?, ?, 0, ?, ?)",
    )
      .bind(calendarId, "evt-1", "Svømning", "2026-09-20T14:00:00.000Z", "2026-09-20T15:00:00.000Z")
      .run();

    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "evt-1",
            summary: "Svømning (ny bane)",
            start: { dateTime: "2026-09-20T14:00:00.000Z" },
            end: { dateTime: "2026-09-20T15:00:00.000Z" },
          },
        ],
        nextSyncToken: "new-token",
      }),
    );

    await syncCalendarActivity(env, now);

    const activity = await env.DB.prepare("SELECT * FROM calendar_activity_log").all();
    expect(activity.results).toHaveLength(0);

    const snapshot = await env.DB.prepare("SELECT safe_title AS safeTitle FROM calendar_event_snapshots WHERE event_id = ?")
      .bind("evt-1")
      .first<{ safeTitle: string }>();
    expect(snapshot?.safeTitle).toBe("Svømning (ny bane)");
  });

  it("falls back to a bootstrap (no false activity) when the syncToken has expired", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    await env.DB.prepare(
      "INSERT INTO calendar_sync_state (google_calendar_id, family_id, sync_token, updated_at) VALUES (?, ?, ?, ?)",
    )
      .bind(calendarId, "family-1", "expired-token", new Date().toISOString())
      .run();

    await env.DB.prepare(
      "INSERT INTO calendar_event_snapshots (google_calendar_id, event_id, safe_title, is_private, start, end) VALUES (?, ?, ?, 0, ?, ?)",
    )
      .bind(calendarId, "evt-old", "Gammel aftale", "2026-09-10T10:00:00.000Z", "2026-09-10T11:00:00.000Z")
      .run();

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Gone" } }, 410))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: "evt-existing", summary: "Fortsat aftale", start: { dateTime: "2026-09-20T10:00:00.000Z" }, end: { dateTime: "2026-09-20T11:00:00.000Z" } },
          ],
          nextSyncToken: "fresh-token",
        }),
      );

    await syncCalendarActivity(env, now);

    const activity = await env.DB.prepare("SELECT * FROM calendar_activity_log").all();
    expect(activity.results).toHaveLength(0);

    const oldSnapshot = await env.DB.prepare("SELECT event_id FROM calendar_event_snapshots WHERE event_id = ?")
      .bind("evt-old")
      .first();
    expect(oldSnapshot).toBeNull();

    const freshSnapshot = await env.DB.prepare("SELECT event_id FROM calendar_event_snapshots WHERE event_id = ?")
      .bind("evt-existing")
      .first();
    expect(freshSnapshot).not.toBeNull();

    const state = await env.DB.prepare("SELECT sync_token AS syncToken FROM calendar_sync_state WHERE google_calendar_id = ?")
      .bind(calendarId)
      .first<{ syncToken: string }>();
    expect(state?.syncToken).toBe("fresh-token");
  });

  it("skips a family without a Google connection instead of throwing", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);
    getGoogleAccessTokenMock.mockRejectedValue(new GoogleNotConnectedError());

    await expect(syncCalendarActivity(env, now)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("continues with the next family when one family's sync fails", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env, { familyId: "family-1" });
    await seedFamilyWithCalendar(env, { familyId: "family-2", googleCalendarId: "secondary" });

    getGoogleAccessTokenMock.mockImplementation(async (_env, userId) => {
      if (userId === "owner-family-1") {
        throw new Error("Google er nede");
      }
      return "access-token";
    });

    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextSyncToken: "token" }));

    await expect(syncCalendarActivity(env, now)).resolves.toBeUndefined();

    const state = await env.DB.prepare("SELECT sync_token AS syncToken FROM calendar_sync_state WHERE google_calendar_id = ?")
      .bind("secondary")
      .first<{ syncToken: string }>();
    expect(state?.syncToken).toBe("token");
  });
});

describe("cleanupOldCalendarActivity", () => {
  it("deletes activity older than 90 days but keeps newer rows", async () => {
    const env = createFakeEnv();
    await seedFamilyWithCalendar(env);

    const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      "INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, detected_at) VALUES (?, 'family-1', 'created', 'Gammel', ?)",
    )
      .bind("old-row", old)
      .run();
    await env.DB.prepare(
      "INSERT INTO calendar_activity_log (id, family_id, change_type, safe_title, detected_at) VALUES (?, 'family-1', 'created', 'Ny', ?)",
    )
      .bind("recent-row", recent)
      .run();

    await cleanupOldCalendarActivity(env.DB);

    const { results } = await env.DB.prepare("SELECT id FROM calendar_activity_log").all<{ id: string }>();
    expect(results.map((row) => row.id)).toEqual(["recent-row"]);
  });
});
