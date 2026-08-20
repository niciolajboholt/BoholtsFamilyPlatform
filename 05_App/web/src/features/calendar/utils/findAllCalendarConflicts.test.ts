import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import { findAllCalendarConflicts } from "./findAllCalendarConflicts";

function event(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "id">): CalendarEvent {
  return {
    title: "Aftale",
    start: "2026-08-20T10:00:00.000Z",
    end: "2026-08-20T11:00:00.000Z",
    allDay: false,
    ownerIds: ["nicolaj"],
    source: "internal",
    sourceId: "local:family",
    ...overrides,
  };
}

describe("findAllCalendarConflicts", () => {
  it("returns an empty set when nothing overlaps", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T12:00:00.000Z", end: "2026-08-20T13:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags two overlapping events with the same owner", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T10:30:00.000Z", end: "2026-08-20T11:30:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b"]));
  });

  it("does not flag overlapping events with different owners and no shared owner", () => {
    const events = [
      event({ id: "a", ownerIds: ["nicolaj"] }),
      event({ id: "b", ownerIds: ["christine"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags overlapping events when 'family' is a shared owner", () => {
    const events = [
      event({ id: "a", ownerIds: ["family"] }),
      event({ id: "b", ownerIds: ["family"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b"]));
  });

  // Fejl fundet af Nicolaj (2026-08-20): en familie-rettet aftale ("family")
  // og en aftale for et bestemt medlem ("alfred") blev aldrig markeret som
  // konflikt, selvom de tidsmæssigt overlappede — "family" matchede aldrig
  // bogstaveligt et specifikt medlems id.
  it("flags overlapping events between 'family' and a specific member", () => {
    const events = [
      event({ id: "a", ownerIds: ["family"] }),
      event({ id: "b", ownerIds: ["alfred"] }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b"]));
  });

  it("does not flag adjacent (touching, non-overlapping) events", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T11:00:00.000Z", end: "2026-08-20T12:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });

  it("flags all three events in a chain of overlaps", () => {
    const events = [
      event({ id: "a", start: "2026-08-20T10:00:00.000Z", end: "2026-08-20T11:00:00.000Z" }),
      event({ id: "b", start: "2026-08-20T10:30:00.000Z", end: "2026-08-20T11:30:00.000Z" }),
      event({ id: "c", start: "2026-08-20T11:15:00.000Z", end: "2026-08-20T12:00:00.000Z" }),
    ];

    expect(findAllCalendarConflicts(events)).toEqual(new Set(["a", "b", "c"]));
  });

  it("does not flag an event against itself when only one event is given", () => {
    const events = [event({ id: "a" })];

    expect(findAllCalendarConflicts(events)).toEqual(new Set());
  });
});
