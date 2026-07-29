import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import type { RecurrenceException } from "../preferences/recurrenceExceptionsStorage";
import { expandRecurringEvents } from "./expandRecurringEvents";

function buildEvent(
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: "event-master",
    title: "Ugentligt møde",
    start: "2026-08-03T09:00:00.000",
    end: "2026-08-03T10:00:00.000",
    allDay: false,
    ownerIds: ["family"],
    source: "internal",
    sourceId: "local:family",
    ...overrides,
  };
}

const wideRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2027-01-01T00:00:00.000Z",
};

describe("expandRecurringEvents", () => {
  it("returns a non-recurring event unchanged", () => {
    const event = buildEvent();

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result).toEqual([event]);
  });

  it("expands a daily recurrence into count occurrences", () => {
    const event = buildEvent({
      recurrence: { frequency: "daily", interval: 1, endType: "count", count: 3 },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result).toHaveLength(3);
    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
    result.forEach((occurrence) => {
      expect(occurrence.recurrenceMasterId).toBe("event-master");
      expect(occurrence.recurrence).toBeUndefined();
      expect(new Date(occurrence.start).getHours()).toBe(9);
    });
  });

  it("expands a weekly recurrence with an interval greater than 1", () => {
    const event = buildEvent({
      recurrence: { frequency: "weekly", interval: 2, endType: "count", count: 3 },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    const startDates = result.map((occurrence) => occurrence.start.slice(0, 10));
    expect(startDates).toEqual(["2026-08-03", "2026-08-17", "2026-08-31"]);
  });

  it("expands a monthly recurrence, preserving the day of month", () => {
    const event = buildEvent({
      start: "2026-08-15T14:00:00.000",
      end: "2026-08-15T15:00:00.000",
      recurrence: { frequency: "monthly", interval: 1, endType: "count", count: 3 },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
    ]);
  });

  it("expands a yearly recurrence", () => {
    const event = buildEvent({
      recurrence: { frequency: "yearly", interval: 1, endType: "count", count: 2 },
    });

    const result = expandRecurringEvents(
      [event],
      { start: "2026-01-01T00:00:00.000Z", end: "2030-01-01T00:00:00.000Z" },
      [],
    );

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-03",
      "2027-08-03",
    ]);
  });

  it("stops generating occurrences after the until date", () => {
    const event = buildEvent({
      recurrence: {
        frequency: "daily",
        interval: 1,
        endType: "until",
        until: "2026-08-05T23:59:59.000",
      },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("caps a never-ending recurrence at the given range end", () => {
    const event = buildEvent({
      recurrence: { frequency: "daily", interval: 1, endType: "never" },
    });

    const result = expandRecurringEvents(
      [event],
      { start: "2026-08-01T00:00:00.000Z", end: "2026-08-06T00:00:00.000Z" },
      [],
    );

    expect(result.length).toBeGreaterThan(0);
    result.forEach((occurrence) => {
      expect(new Date(occurrence.start).getTime()).toBeLessThanOrEqual(
        new Date("2026-08-06T00:00:00.000Z").getTime(),
      );
    });
  });

  it("preserves a multi-day all-day event's span across occurrences", () => {
    const event = buildEvent({
      allDay: true,
      start: "2026-08-03T00:00:00.000",
      end: "2026-08-05T00:00:00.000",
      recurrence: { frequency: "weekly", interval: 1, endType: "count", count: 2 },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result).toHaveLength(2);
    result.forEach((occurrence) => {
      const spanMs =
        new Date(occurrence.end).getTime() - new Date(occurrence.start).getTime();
      expect(spanMs).toBe(2 * 24 * 60 * 60 * 1000);
    });
  });

  it("excludes a cancelled occurrence", () => {
    const event = buildEvent({
      recurrence: { frequency: "daily", interval: 1, endType: "count", count: 3 },
    });

    const cancelledOccurrenceStart = new Date(
      "2026-08-04T09:00:00.000",
    ).toISOString();

    const exceptions: RecurrenceException[] = [
      {
        masterEventId: "event-master",
        occurrenceStart: cancelledOccurrenceStart,
        type: "cancelled",
      },
    ];

    const result = expandRecurringEvents([event], wideRange, exceptions);

    expect(result).toHaveLength(2);
    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-05",
    ]);
  });

  it("applies override fields for a modified occurrence", () => {
    const event = buildEvent({
      recurrence: { frequency: "daily", interval: 1, endType: "count", count: 3 },
    });

    const modifiedOccurrenceStart = new Date(
      "2026-08-04T09:00:00.000",
    ).toISOString();

    const exceptions: RecurrenceException[] = [
      {
        masterEventId: "event-master",
        occurrenceStart: modifiedOccurrenceStart,
        type: "modified",
        override: { title: "Flyttet møde", location: "Hjemme" },
      },
    ];

    const result = expandRecurringEvents([event], wideRange, exceptions);

    expect(result).toHaveLength(3);
    const modifiedOccurrence = result.find(
      (occurrence) => occurrence.start.slice(0, 10) === "2026-08-04",
    );
    expect(modifiedOccurrence?.title).toBe("Flyttet møde");
    expect(modifiedOccurrence?.location).toBe("Hjemme");
  });

  it("expands a weekly recurrence across multiple selected weekdays", () => {
    // 2026-08-03 er en mandag. byWeekdays vælger tirsdag(2) og torsdag(4).
    const event = buildEvent({
      recurrence: {
        frequency: "weekly",
        interval: 1,
        endType: "count",
        count: 4,
        byWeekdays: [2, 4],
      },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-04",
      "2026-08-06",
      "2026-08-11",
      "2026-08-13",
    ]);
  });

  it("does not emit a selected weekday that falls before the series' own start date in its first week", () => {
    // 2026-08-06 er en torsdag. byWeekdays vælger mandag(1, tidligere samme
    // uge, skal springes over) og torsdag(4, == startdatoen).
    const event = buildEvent({
      start: "2026-08-06T09:00:00.000",
      end: "2026-08-06T10:00:00.000",
      recurrence: {
        frequency: "weekly",
        interval: 1,
        endType: "count",
        count: 3,
        byWeekdays: [1, 4],
      },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-06",
      "2026-08-10",
      "2026-08-13",
    ]);
  });

  it("respects the interval for a multi-weekday weekly recurrence (every other week)", () => {
    const event = buildEvent({
      recurrence: {
        frequency: "weekly",
        interval: 2,
        endType: "count",
        count: 4,
        byWeekdays: [1, 3],
      },
    });

    const result = expandRecurringEvents([event], wideRange, []);

    expect(result.map((occurrence) => occurrence.start.slice(0, 10))).toEqual([
      "2026-08-03",
      "2026-08-05",
      "2026-08-17",
      "2026-08-19",
    ]);
  });

  it("excludes occurrences entirely outside the requested range", () => {
    const event = buildEvent({
      recurrence: { frequency: "daily", interval: 1, endType: "count", count: 10 },
    });

    const result = expandRecurringEvents(
      [event],
      { start: "2026-08-06T00:00:00.000Z", end: "2026-08-07T23:59:59.000Z" },
      [],
    );

    result.forEach((occurrence) => {
      expect(["2026-08-06", "2026-08-07"]).toContain(
        occurrence.start.slice(0, 10),
      );
    });
  });
});
