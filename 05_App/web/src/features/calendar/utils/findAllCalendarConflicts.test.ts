import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import {
  findAllCalendarConflicts,
  isExcludedFromCalendarConflicts,
  shouldCalendarEventsConflict,
} from "./findAllCalendarConflicts";

function event(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "id">): CalendarEvent {
  return {
    title: "Aftale",
    start: "2026-08-20T10:00:00.000Z",
    end: "2026-08-20T11:00:00.000Z",
    allDay: false,
    ownerIds: ["nicolaj"],
    source: "internal",
    sourceId: "local:nicolaj",
    ...overrides,
  };
}

describe("shouldCalendarEventsConflict", () => {
  it("allows conflicts inside the same calendar even when owners differ", () => {
    expect(
      shouldCalendarEventsConflict(
        event({ id: "a", ownerIds: ["nicolaj"] }),
        event({ id: "b", ownerIds: ["christine"] }),
      ),
    ).toBe(true);
  });

  it("does not conflict two different person calendars", () => {
    expect(
      shouldCalendarEventsConflict(
        event({ id: "a", sourceId: "google:work", ownerIds: ["nicolaj"] }),
        event({ id: "b", sourceId: "google:private", ownerIds: ["nicolaj"] }),
      ),
    ).toBe(false);
  });

  it("conflicts the family calendar with another calendar", () => {
    expect(
      shouldCalendarEventsConflict(
        event({ id: "family", sourceId: "local:family", ownerIds: ["family"] }),
        event({ id: "other", sourceId: "google:work", ownerIds: ["christine"] }),
      ),
    ).toBe(true);
  });
});

describe("isExcludedFromCalendarConflicts", () => {
  it("excludes every ICS subscription, also when it is member-linked", () => {
    expect(
      isExcludedFromCalendarConflicts(
        event({
          id: "ics",
          source: "ics",
          sourceId: "ics:shared-work",
          ownerIds: ["nicolaj"],
        }),
      ),
    ).toBe(true);
  });

  it.each([
    "google:da.danish%23holiday%40group.v.calendar.google.com",
    "google:weeknumbers%23weeknum%40group.v.calendar.google.com",
  ])("excludes Google's informational calendar %s", (sourceId) => {
    expect(
      isExcludedFromCalendarConflicts(
        event({ id: sourceId, source: "google", sourceId }),
      ),
    ).toBe(true);
  });
});

describe("findAllCalendarConflicts", () => {
  it("returns an empty set when nothing overlaps", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T12:00:00.000Z", end: "2026-08-20T13:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags overlapping events inside the same calendar", () => {
    const events = [
      event({ id: "a", ownerIds: ["nicolaj"] }),
      event({ id: "b", ownerIds: ["christine"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b"]));
  });

  it("does not flag different person calendars even with the same owner", () => {
    const events = [
      event({ id: "a", sourceId: "google:work" }),
      event({ id: "b", sourceId: "google:private" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags an overlapping family event against another calendar", () => {
    const events = [
      event({ id: "family", sourceId: "local:family", ownerIds: ["family"] }),
      event({ id: "work", sourceId: "google:work", ownerIds: ["nicolaj"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["family", "work"]));
  });

  it("never flags a shared ICS subscription", () => {
    const events = [
      event({
        id: "ics",
        source: "ics",
        sourceId: "ics:shared-work",
        ownerIds: ["family"],
      }),
      event({ id: "family", sourceId: "local:family", ownerIds: ["family"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("never flags holidays or week numbers", () => {
    const events = [
      event({
        id: "holiday",
        source: "google",
        sourceId: "google:da.danish%23holiday%40group.v.calendar.google.com",
        allDay: true,
      }),
      event({
        id: "week-number",
        source: "google",
        sourceId: "google:weeknumbers%23weeknum%40group.v.calendar.google.com",
        allDay: true,
      }),
      event({
        id: "family",
        sourceId: "local:family",
        ownerIds: ["family"],
        allDay: true,
      }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("does not flag adjacent (touching, non-overlapping) events", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T11:00:00.000Z", end: "2026-08-20T12:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags all events in a chain of same-calendar overlaps", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T10:30:00.000Z", end: "2026-08-20T11:30:00.000Z" }),
      event({ id: "c", start: "2026-08-20T11:15:00.000Z", end: "2026-08-20T12:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b", "c"]));
  });

  it("does not flag an event against itself when only one event is given", () => {
    expect(findAllCalendarConflicts([event({ id: "a" })])).toEqual(new Set());
  });
});
