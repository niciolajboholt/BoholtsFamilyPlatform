import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarEventRange } from "../models/calendarProvider";
import { isEventWithinRange } from "./LocalCalendarProvider";

function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    title: "Aftale",
    start: "2026-07-30T10:00:00.000Z",
    end: "2026-07-30T11:00:00.000Z",
    allDay: false,
    ownerIds: [],
    source: "internal",
    sourceId: "local:family",
    ...overrides,
  };
}

const range: CalendarEventRange = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-08-01T00:00:00.000Z",
};

describe("isEventWithinRange", () => {
  it("keeps a plain event that overlaps the range", () => {
    expect(isEventWithinRange(buildEvent(), range)).toBe(true);
  });

  it("drops a plain event entirely before the range", () => {
    const event = buildEvent({
      start: "2026-06-01T10:00:00.000Z",
      end: "2026-06-01T11:00:00.000Z",
    });

    expect(isEventWithinRange(event, range)).toBe(false);
  });

  it("drops a plain event entirely after the range", () => {
    const event = buildEvent({
      start: "2026-09-01T10:00:00.000Z",
      end: "2026-09-01T11:00:00.000Z",
    });

    expect(isEventWithinRange(event, range)).toBe(false);
  });

  it("always keeps a recurring master event, even if its first occurrence is outside the range", () => {
    const event = buildEvent({
      start: "2020-01-06T10:00:00.000Z",
      end: "2020-01-06T11:00:00.000Z",
      recurrence: {
        frequency: "weekly",
        interval: 1,
        endType: "never",
      },
    });

    expect(isEventWithinRange(event, range)).toBe(true);
  });
});
