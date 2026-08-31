import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

vi.mock("./googleConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./googleConnection")>();
  return { ...actual, getGoogleAccessToken: vi.fn() };
});

const { getGoogleAccessToken } = await import("./googleConnection");
const { fetchPublicFamilyCalendarEvents } = await import("./googleCalendarAggregation");

const getGoogleAccessTokenMock = vi.mocked(getGoogleAccessToken);

async function seedFamily(env: ReturnType<typeof createFakeEnv>, familyId = "family-1"): Promise<string> {
  await seedUser(env.DB as never, { id: "creator" });
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(familyId, "Boholt", "creator", new Date().toISOString())
    .run();

  return familyId;
}

async function seedMemberMapping(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  memberId: string,
  memberName: string,
  googleCalendarId: string,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, created_at) VALUES (?, ?, ?, ?, 0, ?)",
  )
    .bind(memberId, familyId, memberName, "#2E7D32", new Date().toISOString())
    .run();
  await env.DB.prepare(
    "INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id) VALUES (?, ?, ?)",
  )
    .bind(familyId, googleCalendarId, memberId)
    .run();
}

describe("fetchPublicFamilyCalendarEvents", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    getGoogleAccessTokenMock.mockReset().mockResolvedValue("access-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when no member ids are given", async () => {
    const env = createFakeEnv();
    const events = await fetchPublicFamilyCalendarEvents(env, "family-1", "creator", [], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps and returns events for the mapped member, including member name/color", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-1",
              summary: "Fødselsdag",
              start: { dateTime: "2026-08-20T10:00:00.000Z" },
              end: { dateTime: "2026-08-20T11:00:00.000Z" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([
      {
        title: "Fødselsdag",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        description: undefined,
        location: undefined,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);
  });

  it("filters out cancelled events", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-1",
              status: "cancelled",
              start: { dateTime: "2026-08-20T10:00:00.000Z" },
              end: { dateTime: "2026-08-20T11:00:00.000Z" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([]);
  });

  it("redigerer private detaljer før delelink og AI modtager eventet", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "private-event",
              visibility: "private",
              summary: "Fortrolig behandling",
              description: "Følsomme noter",
              location: "Klinik 4",
              start: { dateTime: "2026-08-20T10:00:00.000Z" },
              end: { dateTime: "2026-08-20T11:00:00.000Z" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events[0]).toEqual(
      expect.objectContaining({
        title: "Optaget",
        description: undefined,
        location: undefined,
      }),
    );
    expect(JSON.stringify(events)).not.toContain("Fortrolig behandling");
    expect(JSON.stringify(events)).not.toContain("Følsomme noter");
    expect(JSON.stringify(events)).not.toContain("Klinik 4");
  });

  it("maps an all-day event to UTC midnight boundaries", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: "evt-1", summary: "Ferie", start: { date: "2026-08-20" }, end: { date: "2026-08-21" } },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([
      expect.objectContaining({
        allDay: true,
        start: "2026-08-20T00:00:00.000Z",
        end: "2026-08-21T00:00:00.000Z",
      }),
    ]);
  });

  it("skips a calendar whose fetch fails, without throwing", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");

    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([]);
  });

  it("only includes calendars mapped to the given member ids", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    await seedMemberMapping(env, familyId, "member-1", "Alfred", "alfred@group.calendar.google.com");
    await seedMemberMapping(env, familyId, "member-2", "Freja", "freja@group.calendar.google.com");

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-1",
              summary: "Kun Alfred",
              start: { dateTime: "2026-08-20T10:00:00.000Z" },
              end: { dateTime: "2026-08-20T11:00:00.000Z" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-1"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list — not every calendar — when the family has no mapping at all for the given member", async () => {
    const env = createFakeEnv();
    const familyId = await seedFamily(env);
    // Bevidst INGEN seedMemberMapping-kald: et familiemedlem, der aldrig har
    // koblet en Google-kalender. Den sikre standard er at vise intet for
    // vedkommende, ikke at gætte eller falde tilbage til en anden kalender.
    await env.DB.prepare(
      "INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, created_at) VALUES (?, ?, ?, ?, 0, ?)",
    )
      .bind("member-unmapped", familyId, "Ukoblet", "#2E7D32", new Date().toISOString())
      .run();

    const events = await fetchPublicFamilyCalendarEvents(env, familyId, "creator", ["member-unmapped"], {
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });

    expect(events).toEqual([]);
    expect(getGoogleAccessTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
