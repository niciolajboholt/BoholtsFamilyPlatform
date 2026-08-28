import { describe, expect, it } from "vitest";

import { mapGoogleEventWriteRequest, toCalendarDate } from "./googleCalendarWriteMapper";
import { CalendarProviderError } from "../calendarProviderErrors";
import { createAllDayDate } from "../../form/eventFormDateUtils";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";

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
});
