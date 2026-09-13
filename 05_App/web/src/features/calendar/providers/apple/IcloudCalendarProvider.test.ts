// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarOwner } from "../../data/calendarOwners";
import { CalendarProviderError } from "../calendarProviderErrors";
import { setExcludedIcloudCalendars } from "./icloudCalendarExclusionStorage";
import { encodeIcloudCalendarSourceId, encodeIcloudEventId } from "./icloudCalendarIds";
import { IcloudCalendarProvider } from "./IcloudCalendarProvider";

const getMyFamily = vi.fn();
const getIcloudConnections = vi.fn();
const getIcloudCalendars = vi.fn();
const getIcloudCalendarEvents = vi.fn();
const createIcloudCalendarEvent = vi.fn();
const updateIcloudCalendarEvent = vi.fn();
const deleteIcloudCalendarEvent = vi.fn();

vi.mock("../../../family/familyApi", () => ({
  getMyFamily: (...args: unknown[]) => getMyFamily(...args),
  getIcloudConnections: (...args: unknown[]) => getIcloudConnections(...args),
  getIcloudCalendars: (...args: unknown[]) => getIcloudCalendars(...args),
  getIcloudCalendarEvents: (...args: unknown[]) => getIcloudCalendarEvents(...args),
  createIcloudCalendarEvent: (...args: unknown[]) => createIcloudCalendarEvent(...args),
  updateIcloudCalendarEvent: (...args: unknown[]) => updateIcloudCalendarEvent(...args),
  deleteIcloudCalendarEvent: (...args: unknown[]) => deleteIcloudCalendarEvent(...args),
}));

// Sprint 48: ejerskab kommer nu fra calendar_member_mappings, nøglet på
// kalenderens rå CalDAV-URL — samme mock-mønster som GoogleCalendarProvider.test.ts.
const refreshCalendarMemberMappingsFromServer = vi.fn().mockResolvedValue(undefined);
const getCalendarMemberMappings = vi.fn<() => Record<string, string>>().mockReturnValue({});
const getMappedOwnersByCalendarId = vi
  .fn<() => Map<string, CalendarOwner>>()
  .mockReturnValue(new Map());

vi.mock("../../preferences/calendarMemberMappingStorage", () => ({
  refreshCalendarMemberMappingsFromServer: (...args: unknown[]) =>
    refreshCalendarMemberMappingsFromServer(...args),
  getCalendarMemberMappings: (...args: unknown[]) => getCalendarMemberMappings(...args),
  getMappedOwnersByCalendarId: (...args: unknown[]) => getMappedOwnersByCalendarId(...args),
}));

const getFamilyMembers = vi.fn<() => CalendarOwner[]>().mockReturnValue([]);

vi.mock("../../preferences/familyMembersStorage", () => ({
  getFamilyMembers: (...args: unknown[]) => getFamilyMembers(...args),
}));

const familyId = "family-1";
const connectionId = "conn-1";
const calendarUrl = "https://p05-caldav.icloud.com/123/calendars/home/";

describe("IcloudCalendarProvider", () => {
  let provider: IcloudCalendarProvider;

  beforeEach(() => {
    window.localStorage.clear();
    provider = new IcloudCalendarProvider();
    getMyFamily.mockReset().mockResolvedValue({ ok: true, data: { family: { id: familyId } } });
    getIcloudConnections.mockReset().mockResolvedValue({
      ok: true,
      data: { connections: [{ id: connectionId, appleIdEmail: "nicolaj@icloud.com", familyMemberId: null }] },
    });
    getIcloudCalendars.mockReset().mockResolvedValue({
      ok: true,
      data: { calendars: [{ url: calendarUrl, displayName: "Hjem", ctag: "abc" }] },
    });
    getIcloudCalendarEvents.mockReset().mockResolvedValue({ ok: true, data: { events: [] } });
    createIcloudCalendarEvent.mockReset();
    updateIcloudCalendarEvent.mockReset();
    deleteIcloudCalendarEvent.mockReset();
    refreshCalendarMemberMappingsFromServer.mockReset().mockResolvedValue(undefined);
    getCalendarMemberMappings.mockReset().mockReturnValue({});
    getMappedOwnersByCalendarId.mockReset().mockReturnValue(new Map());
    getFamilyMembers.mockReset().mockReturnValue([]);
  });

  describe("getCalendars", () => {
    it("maps discovered calendars into writable calendar sources", async () => {
      const sources = await provider.getCalendars();

      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatchObject({ name: "Hjem", providerType: "apple", isReadOnly: false });
    });

    it("isolates a failing connection instead of failing the whole call", async () => {
      getIcloudCalendars.mockRejectedValueOnce(new Error("network down"));

      const sources = await provider.getCalendars();

      expect(sources).toEqual([]);
    });

    it("excludes a calendar the user has fravalgt, without an extra network call", async () => {
      setExcludedIcloudCalendars([encodeIcloudCalendarSourceId(connectionId, calendarUrl)]);

      const sources = await provider.getCalendars();

      expect(sources).toEqual([]);
    });

    it("bruger calendar_member_mappings (nøglet på CalDAV-URL'en), ikke forbindelsens familyMemberId", async () => {
      const owner: CalendarOwner = { id: "member-1", name: "Alfred", color: "#123456" };
      getMappedOwnersByCalendarId.mockReturnValue(new Map([[calendarUrl, owner]]));

      const sources = await provider.getCalendars();

      expect(refreshCalendarMemberMappingsFromServer).toHaveBeenCalled();
      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatchObject({ name: "Alfred", color: "#123456" });
    });
  });

  describe("getEvents", () => {
    it("fetches events for every discovered calendar across every connection", async () => {
      getIcloudCalendarEvents.mockResolvedValueOnce({
        ok: true,
        data: {
          events: [
            {
              href: `${calendarUrl}event1.ics`,
              etag: '"1"',
              uid: "event1",
              title: "Tandlæge",
              start: "2026-10-01T10:00:00.000Z",
              end: "2026-10-01T10:30:00.000Z",
              allDay: false,
            },
          ],
        },
      });

      const events = await provider.getEvents({
        start: "2026-09-01T00:00:00.000Z",
        end: "2026-11-01T00:00:00.000Z",
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ source: "apple", title: "Tandlæge" });
    });

    it("sætter ownerIds fra calendar_member_mappings, nøglet på kalenderens URL", async () => {
      getCalendarMemberMappings.mockReturnValue({ [calendarUrl]: "member-1" });
      getIcloudCalendarEvents.mockResolvedValueOnce({
        ok: true,
        data: {
          events: [
            {
              href: `${calendarUrl}event1.ics`,
              etag: '"1"',
              uid: "event1",
              title: "Tandlæge",
              start: "2026-10-01T10:00:00.000Z",
              end: "2026-10-01T10:30:00.000Z",
              allDay: false,
            },
          ],
        },
      });

      const events = await provider.getEvents({
        start: "2026-09-01T00:00:00.000Z",
        end: "2026-11-01T00:00:00.000Z",
      });

      expect(events[0]?.ownerIds).toEqual(["member-1"]);
    });

    it("skips the event fetch entirely for a calendar the user has fravalgt", async () => {
      setExcludedIcloudCalendars([encodeIcloudCalendarSourceId(connectionId, calendarUrl)]);

      const events = await provider.getEvents({
        start: "2026-09-01T00:00:00.000Z",
        end: "2026-11-01T00:00:00.000Z",
      });

      expect(events).toEqual([]);
      expect(getIcloudCalendarEvents).not.toHaveBeenCalled();
    });
  });

  describe("createEvent", () => {
    it("creates an event against the decoded connection/calendar and maps the result", async () => {
      createIcloudCalendarEvent.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { uid: "new-uid", href: `${calendarUrl}new-uid.ics`, etag: '"1"' },
      });

      const event = await provider.createEvent({
        title: "Fødselsdag",
        start: "2026-10-05T18:00:00.000Z",
        end: "2026-10-05T20:00:00.000Z",
        allDay: false,
        ownerIds: [],
        sourceId: encodeIcloudCalendarSourceId(connectionId, calendarUrl),
      });

      expect(createIcloudCalendarEvent).toHaveBeenCalledWith(
        familyId,
        connectionId,
        expect.objectContaining({ calendarUrl, title: "Fødselsdag" }),
      );
      expect(event.source).toBe("apple");
      expect(event.title).toBe("Fødselsdag");
    });

    it("rejects without a sourceId", async () => {
      await expect(
        provider.createEvent({
          title: "X",
          start: "2026-10-05T18:00:00.000Z",
          end: "2026-10-05T20:00:00.000Z",
          allDay: false,
          ownerIds: [],
        }),
      ).rejects.toThrow(CalendarProviderError);
    });
  });

  describe("updateEvent", () => {
    it("refuses to update an event that has no known etag", async () => {
      const eventId = encodeIcloudEventId(
        connectionId,
        calendarUrl,
        "event1",
        `${calendarUrl}event1.ics`,
        null,
      );

      await expect(
        provider.updateEvent({
          id: eventId,
          title: "X",
          start: "2026-10-01T10:00:00.000Z",
          end: "2026-10-01T10:30:00.000Z",
          allDay: false,
          ownerIds: [],
          source: "apple",
          sourceId: encodeIcloudCalendarSourceId(connectionId, calendarUrl),
        }),
      ).rejects.toThrow(CalendarProviderError);

      expect(updateIcloudCalendarEvent).not.toHaveBeenCalled();
    });

    it("passes the etag through when one is known", async () => {
      const eventId = encodeIcloudEventId(
        connectionId,
        calendarUrl,
        "event1",
        `${calendarUrl}event1.ics`,
        '"1"',
      );
      updateIcloudCalendarEvent.mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { uid: "event1", href: `${calendarUrl}event1.ics`, etag: '"2"' },
      });

      await provider.updateEvent({
        id: eventId,
        title: "Tandlæge (flyttet)",
        start: "2026-10-01T11:00:00.000Z",
        end: "2026-10-01T11:30:00.000Z",
        allDay: false,
        ownerIds: [],
        source: "apple",
        sourceId: encodeIcloudCalendarSourceId(connectionId, calendarUrl),
      });

      expect(updateIcloudCalendarEvent).toHaveBeenCalledWith(
        familyId,
        connectionId,
        expect.objectContaining({ uid: "event1", etag: '"1"' }),
      );
    });
  });

  describe("deleteEvent", () => {
    it("refuses to delete an event that has no known etag", async () => {
      const eventId = encodeIcloudEventId(
        connectionId,
        calendarUrl,
        "event1",
        `${calendarUrl}event1.ics`,
        null,
      );

      await expect(provider.deleteEvent(eventId)).rejects.toThrow(CalendarProviderError);
      expect(deleteIcloudCalendarEvent).not.toHaveBeenCalled();
    });

    it("deletes using the decoded href and etag", async () => {
      const eventId = encodeIcloudEventId(
        connectionId,
        calendarUrl,
        "event1",
        `${calendarUrl}event1.ics`,
        '"1"',
      );
      deleteIcloudCalendarEvent.mockResolvedValueOnce({ ok: true, data: { ok: true } });

      await provider.deleteEvent(eventId);

      expect(deleteIcloudCalendarEvent).toHaveBeenCalledWith(familyId, connectionId, {
        eventHref: `${calendarUrl}event1.ics`,
        etag: '"1"',
      });
    });
  });

  describe("restoreEvent", () => {
    it("is not supported", async () => {
      await expect(
        provider.restoreEvent({
          id: "x",
          title: "X",
          start: "2026-10-01T10:00:00.000Z",
          end: "2026-10-01T10:30:00.000Z",
          allDay: false,
          ownerIds: [],
          source: "apple",
          sourceId: "icloud:conn-1:x",
        }),
      ).rejects.toThrow(CalendarProviderError);
    });
  });
});
