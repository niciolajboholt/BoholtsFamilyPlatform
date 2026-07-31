import { describe, expect, it } from "vitest";

import {
  isGoogleCalendarWritable,
  mapGoogleCalendarEvent,
  mapGoogleCalendarSource,
  toLocalMidnightIso,
} from "./googleCalendarMapper";
import type { GoogleCalendarEvent } from "./googleCalendarTypes";

describe("toLocalMidnightIso", () => {
  it("keeps a bare date on the same local calendar day (regression: was shifted by the UTC offset)", () => {
    const iso = toLocalMidnightIso("2026-07-31");

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

describe("isGoogleCalendarWritable", () => {
  it.each([
    ["owner", true],
    ["writer", true],
    ["reader", false],
    ["freeBusyReader", false],
    [undefined, false],
    ["not-a-real-role", false],
  ] as const)("accessRole %s -> writable %s", (accessRole, expected) => {
    expect(isGoogleCalendarWritable(accessRole)).toBe(expected);
  });
});

describe("mapGoogleCalendarSource", () => {
  it("marks an owner/writer calendar as not read-only", () => {
    const source = mapGoogleCalendarSource({
      id: "nicolaj@example.com",
      summary: "Nicolaj",
      accessRole: "owner",
    });

    expect(source?.isReadOnly).toBe(false);
  });

  it("marks a reader calendar as read-only", () => {
    const source = mapGoogleCalendarSource({
      id: "shared@example.com",
      summary: "Delt kalender",
      accessRole: "reader",
    });

    expect(source?.isReadOnly).toBe(true);
  });

  it("returns null when the entry has no id", () => {
    expect(mapGoogleCalendarSource({ summary: "Uden id" })).toBeNull();
  });

  it("uses the mapped owner's name and color instead of Google's own, when given one", () => {
    const source = mapGoogleCalendarSource(
      {
        id: "nicolajbach12@gmail.com",
        summary: "nicolajbach12@gmail.com",
        backgroundColor: "#123456",
      },
      { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
    );

    expect(source?.name).toBe("Nicolaj");
    expect(source?.color).toBe("#2E7D32");
  });

  it("falls back to Google's own name/color when no owner is mapped", () => {
    const source = mapGoogleCalendarSource({
      id: "nicolajbach12@gmail.com",
      summary: "nicolajbach12@gmail.com",
      backgroundColor: "#123456",
    });

    expect(source?.name).toBe("nicolajbach12@gmail.com");
    expect(source?.color).toBe("#123456");
  });
});

describe("mapGoogleCalendarEvent", () => {
  const calendarId = "nicolaj@example.com";

  it("maps a timed event using dateTime as-is", () => {
    const event: GoogleCalendarEvent = {
      id: "abc123",
      summary: "Frisør",
      start: { dateTime: "2026-07-31T09:00:00+02:00" },
      end: { dateTime: "2026-07-31T10:00:00+02:00" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event);

    expect(mapped?.allDay).toBe(false);
    expect(mapped?.start).toBe("2026-07-31T09:00:00+02:00");
    expect(mapped?.end).toBe("2026-07-31T10:00:00+02:00");
    expect(mapped?.ownerIds).toEqual([]);
  });

  it("sets ownerIds to the mapped owner, when this calendar is assigned to a family member", () => {
    const event: GoogleCalendarEvent = {
      id: "abc123",
      summary: "Frisør",
      start: { dateTime: "2026-07-31T09:00:00+02:00" },
      end: { dateTime: "2026-07-31T10:00:00+02:00" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event, "nicolaj");

    expect(mapped?.ownerIds).toEqual(["nicolaj"]);
  });

  it("maps a single-day all-day event onto exactly one local day (regression test)", () => {
    // Google represents 31/7 as a single-day event with an exclusive end
    // date of 1/8 — the exact case that used to render on two days.
    const event: GoogleCalendarEvent = {
      id: "allday1",
      summary: "Jeg er i AA",
      start: { date: "2026-07-31" },
      end: { date: "2026-08-01" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event);

    expect(mapped?.allDay).toBe(true);

    const start = new Date(mapped!.start);
    const end = new Date(mapped!.end);

    expect(start.getDate()).toBe(31);
    expect(start.getMonth()).toBe(6);
    expect(end.getDate()).toBe(1);
    expect(end.getMonth()).toBe(7);

    // The exclusive-end boundary must land exactly at local midnight, not
    // after it — otherwise the day-bucketing overlap check in
    // getEventsForDate.ts treats the event as also occurring on 1/8.
    expect(end.getHours()).toBe(0);
    expect(end.getMinutes()).toBe(0);
  });

  it("maps a multi-day all-day event across the correct days", () => {
    const event: GoogleCalendarEvent = {
      id: "allday2",
      summary: "Ferie",
      start: { date: "2026-08-01" },
      end: { date: "2026-08-04" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event);

    const start = new Date(mapped!.start);
    const end = new Date(mapped!.end);

    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(4);
  });

  it("filters out a cancelled event", () => {
    const event: GoogleCalendarEvent = {
      id: "cancelled1",
      status: "cancelled",
      start: { dateTime: "2026-07-31T09:00:00Z" },
      end: { dateTime: "2026-07-31T10:00:00Z" },
    };

    expect(mapGoogleCalendarEvent(calendarId, event)).toBeNull();
  });

  it("maps a recurring event instance and tags it with recurrenceMasterId (Sprint 16)", () => {
    const event: GoogleCalendarEvent = {
      id: "instance1",
      recurringEventId: "series1",
      start: { dateTime: "2026-07-31T09:00:00Z" },
      end: { dateTime: "2026-07-31T10:00:00Z" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event);

    expect(mapped).not.toBeNull();
    expect(mapped?.recurrenceMasterId).toBe("series1");
  });

  it("does not set recurrenceMasterId for a non-recurring event", () => {
    const event: GoogleCalendarEvent = {
      id: "single1",
      start: { dateTime: "2026-07-31T09:00:00Z" },
      end: { dateTime: "2026-07-31T10:00:00Z" },
    };

    const mapped = mapGoogleCalendarEvent(calendarId, event);

    expect(mapped?.recurrenceMasterId).toBeUndefined();
  });

  it("filters out an event missing an id", () => {
    const event: GoogleCalendarEvent = {
      start: { dateTime: "2026-07-31T09:00:00Z" },
      end: { dateTime: "2026-07-31T10:00:00Z" },
    };

    expect(mapGoogleCalendarEvent(calendarId, event)).toBeNull();
  });

  it("filters out an event missing start/end", () => {
    const event: GoogleCalendarEvent = { id: "no-dates" };

    expect(mapGoogleCalendarEvent(calendarId, event)).toBeNull();
  });
});
