import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import { deduplicateCalendarEvents } from "./deduplicateCalendarEvents";

function createEvent(
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: "google-event:calendar-a:event-1",
    title: "Tandlæge",
    start: "2026-08-27T08:00:00.000Z",
    end: "2026-08-27T09:00:00.000Z",
    allDay: false,
    ownerIds: ["nicolaj"],
    source: "google",
    sourceId: "google:calendar-a",
    ...overrides,
  };
}

describe("deduplicateCalendarEvents", () => {
  it("beholder den seneste kopi af præcis samme provider-event", () => {
    const original = createEvent({ title: "Gammel titel" });
    const updated = createEvent({ title: "Ny titel" });

    expect(deduplicateCalendarEvents([original, updated])).toEqual([updated]);
  });

  it("bevarer to ægte events med samme titel og tidspunkt", () => {
    const first = createEvent({ id: "google-event:calendar-a:event-1" });
    const second = createEvent({ id: "google-event:calendar-a:event-2" });

    expect(deduplicateCalendarEvents([first, second])).toEqual([first, second]);
  });

  it("bevarer samme event-id fra forskellige kalenderkilder", () => {
    const first = createEvent({ sourceId: "google:calendar-a" });
    const second = createEvent({ sourceId: "google:calendar-b" });

    expect(deduplicateCalendarEvents([first, second])).toEqual([first, second]);
  });

  it("bevarer forskellige forekomster af en gentagelse", () => {
    const first = createEvent({
      recurrenceMasterId: "series-1",
      recurrenceOccurrenceStart: "2026-08-27T08:00:00.000Z",
    });
    const second = createEvent({
      recurrenceMasterId: "series-1",
      recurrenceOccurrenceStart: "2026-09-03T08:00:00.000Z",
    });

    expect(deduplicateCalendarEvents([first, second])).toEqual([first, second]);
  });
});
