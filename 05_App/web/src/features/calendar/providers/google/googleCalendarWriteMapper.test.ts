import { describe, expect, it } from "vitest";

import {
  mapGoogleEventWriteRequest,
  mapRecurrenceRuleToGoogleRRule,
  toCalendarDate,
} from "./googleCalendarWriteMapper";
import { CalendarProviderError } from "../calendarProviderErrors";
import { createAllDayDate } from "../../form/eventFormDateUtils";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { RecurrenceRule } from "../../models/calendarEvent";

describe("toCalendarDate", () => {
  it("returns the local calendar date regardless of the instant's UTC offset", () => {
    // Local midnight 31/7 in Europe/Copenhagen is 29/7 22:00 UTC — a naive
    // UTC-based extraction would have returned "2026-07-30".
    expect(toCalendarDate(new Date("2026-07-31T00:00:00"))).toBe(
      "2026-07-31",
    );
  });
});

describe("mapGoogleEventWriteRequest", () => {
  const baseInput: CreateCalendarEventInput = {
    title: "Test",
    start: "2026-07-31T09:00:00+02:00",
    end: "2026-07-31T10:00:00+02:00",
    allDay: false,
    ownerIds: ["family"],
    sourceId: "google:nicolaj@example.com",
  };

  it("maps a timed event using ISO dateTime as-is, with an explicit timeZone and a cleared date", () => {
    const request = mapGoogleEventWriteRequest(baseInput);

    expect(request.start).toEqual({
      dateTime: new Date(baseInput.start).toISOString(),
      timeZone: "Europe/Copenhagen",
      date: null,
    });
    expect(request.end).toEqual({
      dateTime: new Date(baseInput.end).toISOString(),
      timeZone: "Europe/Copenhagen",
      date: null,
    });
  });

  it("writes and clears Google's private visibility explicitly", () => {
    expect(
      mapGoogleEventWriteRequest({ ...baseInput, privacy: "busy" }).visibility,
    ).toBe("private");
    expect(mapGoogleEventWriteRequest(baseInput).visibility).toBe("default");
  });

  it("sends the exact locally-selected date for a single-day all-day event, with a cleared dateTime (regression test)", () => {
    // Mirrors what NewEventDialog builds for a single-day all-day event:
    // start = local midnight of the selected day, end = local midnight of
    // the next day (exclusive), via the same createAllDayDate helper.
    const input: CreateCalendarEventInput = {
      ...baseInput,
      allDay: true,
      start: createAllDayDate("2026-07-31", false),
      end: createAllDayDate("2026-07-31", true),
    };

    const request = mapGoogleEventWriteRequest(input);

    expect(request.start).toEqual({
      date: "2026-07-31",
      dateTime: null,
      timeZone: null,
    });
    expect(request.end).toEqual({
      date: "2026-08-01",
      dateTime: null,
      timeZone: null,
    });
  });

  it("throws on an empty title", () => {
    expect(() =>
      mapGoogleEventWriteRequest({ ...baseInput, title: "   " }),
    ).toThrow(CalendarProviderError);
  });

  it("throws when the end is not after the start", () => {
    expect(() =>
      mapGoogleEventWriteRequest({
        ...baseInput,
        start: "2026-07-31T10:00:00+02:00",
        end: "2026-07-31T09:00:00+02:00",
      }),
    ).toThrow(CalendarProviderError);
  });

  it("throws on an invalid date", () => {
    expect(() =>
      mapGoogleEventWriteRequest({ ...baseInput, start: "not-a-date" }),
    ).toThrow(CalendarProviderError);
  });

  it("includes the RRULE recurrence on a create input that has one", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      endType: "never",
      byWeekdays: [1],
    };

    const request = mapGoogleEventWriteRequest({ ...baseInput, recurrence: rule });

    expect(request.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
  });

  it("omits recurrence when the create input has none", () => {
    const request = mapGoogleEventWriteRequest(baseInput);

    expect(request.recurrence).toBeUndefined();
  });

  it("omits recurrence for an ordinary edit input", () => {
    const editInput = {
      title: baseInput.title,
      start: baseInput.start,
      end: baseInput.end,
      allDay: baseInput.allDay,
    };

    const request = mapGoogleEventWriteRequest(editInput);

    expect(request.recurrence).toBeUndefined();
  });

  it("includes recurrence when an existing Google event is converted to a series", () => {
    const request = mapGoogleEventWriteRequest({
      title: baseInput.title,
      start: baseInput.start,
      end: baseInput.end,
      allDay: baseInput.allDay,
      recurrence: {
        frequency: "weekly",
        interval: 1,
        endType: "never",
        byWeekdays: [1],
      },
    });

    expect(request.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
  });
});

describe("mapRecurrenceRuleToGoogleRRule", () => {
  const base: RecurrenceRule = {
    frequency: "daily",
    interval: 1,
    endType: "never",
  };

  it("maps a plain daily recurrence", () => {
    expect(mapRecurrenceRuleToGoogleRRule(base, false)).toEqual([
      "RRULE:FREQ=DAILY",
    ]);
  });

  it("includes INTERVAL only when greater than 1", () => {
    expect(mapRecurrenceRuleToGoogleRRule({ ...base, interval: 2 }, false)).toEqual([
      "RRULE:FREQ=DAILY;INTERVAL=2",
    ]);
  });

  it("maps a weekly recurrence with multiple weekdays", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      endType: "never",
      byWeekdays: [1, 3, 5],
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
    ]);
  });

  it("omits BYDAY for a weekly recurrence with no selected weekdays", () => {
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 1,
      endType: "never",
      byWeekdays: [],
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=WEEKLY",
    ]);
  });

  it("maps a monthly day-of-month recurrence", () => {
    const rule: RecurrenceRule = {
      frequency: "monthly",
      interval: 1,
      endType: "never",
      monthlyPattern: "dayOfMonth",
      byMonthDay: 15,
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=15",
    ]);
  });

  it("maps a monthly ordinal-weekday recurrence (e.g. the 3rd Monday)", () => {
    const rule: RecurrenceRule = {
      frequency: "monthly",
      interval: 1,
      endType: "never",
      monthlyPattern: "dayOfWeek",
      byOrdinalWeekday: { ordinals: [3], weekday: 1 },
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=MONTHLY;BYDAY=3MO",
    ]);
  });

  it("maps a monthly ordinal-weekday recurrence with multiple ordinals (e.g. first and last Friday)", () => {
    const rule: RecurrenceRule = {
      frequency: "monthly",
      interval: 1,
      endType: "never",
      monthlyPattern: "dayOfWeek",
      byOrdinalWeekday: { ordinals: [1, -1], weekday: 5 },
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=MONTHLY;BYDAY=1FR,-1FR",
    ]);
  });

  it("maps a yearly recurrence without an explicit BYMONTH", () => {
    expect(mapRecurrenceRuleToGoogleRRule({ ...base, frequency: "yearly" }, false)).toEqual([
      "RRULE:FREQ=YEARLY",
    ]);
  });

  it("formats UNTIL as a bare date for an all-day event", () => {
    const rule: RecurrenceRule = {
      ...base,
      endType: "until",
      until: "2026-09-30T00:00:00.000Z",
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, true)).toEqual([
      "RRULE:FREQ=DAILY;UNTIL=20260930",
    ]);
  });

  it("formats UNTIL as a UTC date-time for a timed event", () => {
    const rule: RecurrenceRule = {
      ...base,
      endType: "until",
      until: "2026-09-30T18:30:00.000Z",
    };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=DAILY;UNTIL=20260930T183000Z",
    ]);
  });

  it("maps COUNT for a fixed number of occurrences", () => {
    const rule: RecurrenceRule = { ...base, endType: "count", count: 10 };

    expect(mapRecurrenceRuleToGoogleRRule(rule, false)).toEqual([
      "RRULE:FREQ=DAILY;COUNT=10",
    ]);
  });

  it("sets neither UNTIL nor COUNT when the series never ends", () => {
    expect(mapRecurrenceRuleToGoogleRRule(base, false)).toEqual([
      "RRULE:FREQ=DAILY",
    ]);
  });
});
