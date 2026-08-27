import { describe, expect, it } from "vitest";

import {
  mapOutlookCalendarEvent,
  mapOutlookCalendarSource,
  toLocalMidnightIso,
} from "./outlookCalendarMapper";
import type { OutlookCalendarEvent } from "./outlookCalendarTypes";

describe("toLocalMidnightIso", () => {
  it("keeps a bare date on the same local calendar day", () => {
    const iso = toLocalMidnightIso("2026-07-31T00:00:00.0000000");

    expect(iso).toBeDefined();
    const parsed = new Date(iso!);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(31);
    expect(parsed.getHours()).toBe(0);
  });

  it("returns undefined for an undefined input", () => {
    expect(toLocalMidnightIso(undefined)).toBeUndefined();
  });
});

describe("mapOutlookCalendarSource", () => {
  it("marks a writable calendar as not read-only", () => {
    const source = mapOutlookCalendarSource({
      id: "aaa",
      name: "Nicolaj",
      canEdit: true,
    });

    expect(source?.isReadOnly).toBe(false);
  });

  it("marks a non-editable calendar as read-only", () => {
    const source = mapOutlookCalendarSource({
      id: "bbb",
      name: "Delt kalender",
      canEdit: false,
    });

    expect(source?.isReadOnly).toBe(true);
  });

  it("returns null when the entry has no id", () => {
    expect(mapOutlookCalendarSource({ name: "Uden id" })).toBeNull();
  });

  it("uses the mapped owner's name and color instead of Graph's own, when given one", () => {
    const source = mapOutlookCalendarSource(
      { id: "aaa", name: "Nicolaj Boholt", canEdit: true },
      { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
    );

    expect(source?.name).toBe("Nicolaj");
    expect(source?.color).toBe("#2E7D32");
  });

  it("falls back to Graph's own name when no owner is mapped", () => {
    const source = mapOutlookCalendarSource({
      id: "aaa",
      name: "Nicolaj Boholt",
      canEdit: true,
    });

    expect(source?.name).toBe("Nicolaj Boholt");
  });
});

describe("mapOutlookCalendarEvent", () => {
  const calendarId = "aaa";

  it("maps a timed event, adding the missing UTC suffix", () => {
    const event: OutlookCalendarEvent = {
      id: "abc123",
      subject: "Frisør",
      start: { dateTime: "2026-07-31T09:00:00.0000000" },
      end: { dateTime: "2026-07-31T10:00:00.0000000" },
    };

    const mapped = mapOutlookCalendarEvent(calendarId, event);

    expect(mapped?.allDay).toBe(false);
    expect(mapped?.start).toBe("2026-07-31T09:00:00.0000000Z");
    expect(mapped?.end).toBe("2026-07-31T10:00:00.0000000Z");
    expect(mapped?.ownerIds).toEqual([]);
  });

  it("sets ownerIds to the mapped owner, when this calendar is assigned to a family member", () => {
    const event: OutlookCalendarEvent = {
      id: "abc123",
      subject: "Frisør",
      start: { dateTime: "2026-07-31T09:00:00.0000000" },
      end: { dateTime: "2026-07-31T10:00:00.0000000" },
    };

    const mapped = mapOutlookCalendarEvent(calendarId, event, "nicolaj");

    expect(mapped?.ownerIds).toEqual(["nicolaj"]);
  });

  it("maps an all-day event onto exactly one local day", () => {
    const event: OutlookCalendarEvent = {
      id: "allday1",
      subject: "Jeg er i AA",
      isAllDay: true,
      start: { dateTime: "2026-07-31T00:00:00.0000000" },
      end: { dateTime: "2026-08-01T00:00:00.0000000" },
    };

    const mapped = mapOutlookCalendarEvent(calendarId, event);

    expect(mapped?.allDay).toBe(true);

    const start = new Date(mapped!.start);
    const end = new Date(mapped!.end);

    expect(start.getDate()).toBe(31);
    expect(start.getMonth()).toBe(6);
    expect(end.getDate()).toBe(1);
    expect(end.getMonth()).toBe(7);
    expect(end.getHours()).toBe(0);
  });

  it("filters out a cancelled event", () => {
    const event: OutlookCalendarEvent = {
      id: "cancelled1",
      isCancelled: true,
      start: { dateTime: "2026-07-31T09:00:00.0000000" },
      end: { dateTime: "2026-07-31T10:00:00.0000000" },
    };

    expect(mapOutlookCalendarEvent(calendarId, event)).toBeNull();
  });

  it("maps a recurring event instance and tags it with recurrenceMasterId", () => {
    const event: OutlookCalendarEvent = {
      id: "instance1",
      seriesMasterId: "series1",
      start: { dateTime: "2026-07-31T09:00:00.0000000" },
      end: { dateTime: "2026-07-31T10:00:00.0000000" },
    };

    const mapped = mapOutlookCalendarEvent(calendarId, event);

    expect(mapped).not.toBeNull();
    expect(mapped?.recurrenceMasterId).toBe("series1");
  });

  it("marks private and confidential Outlook events as busy-only", () => {
    for (const sensitivity of ["private", "confidential"]) {
      const mapped = mapOutlookCalendarEvent(calendarId, {
        id: `private-${sensitivity}`,
        sensitivity,
        subject: "Fortrolig aftale",
        start: { dateTime: "2026-07-31T09:00:00.0000000" },
        end: { dateTime: "2026-07-31T10:00:00.0000000" },
      });

      expect(mapped?.privacy).toBe("busy");
    }
  });

  it("filters out an event missing an id", () => {
    const event: OutlookCalendarEvent = {
      start: { dateTime: "2026-07-31T09:00:00.0000000" },
      end: { dateTime: "2026-07-31T10:00:00.0000000" },
    };

    expect(mapOutlookCalendarEvent(calendarId, event)).toBeNull();
  });

  it("filters out an event missing start/end", () => {
    const event: OutlookCalendarEvent = { id: "no-dates" };

    expect(mapOutlookCalendarEvent(calendarId, event)).toBeNull();
  });
});
