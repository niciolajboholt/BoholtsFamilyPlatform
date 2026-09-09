import { describe, expect, it } from "vitest";

import { getDefaultCalendarEventRange, providerSupportsRecurrenceCreation } from "./calendarProvider";

describe("getDefaultCalendarEventRange", () => {
  it("returns a bounded window around the reference date, not the ECMAScript date extremes", () => {
    const range = getDefaultCalendarEventRange(new Date("2026-07-30T12:00:00.000Z"));

    expect(range.start).toBe("2025-07-30T12:00:00.000Z");
    expect(range.end).toBe("2028-07-30T12:00:00.000Z");
  });

  it("defaults the reference date to now when none is given", () => {
    const before = Date.now();
    const range = getDefaultCalendarEventRange();
    const after = Date.now();

    const startYear = new Date(range.start).getUTCFullYear();
    const endYear = new Date(range.end).getUTCFullYear();
    const nowYear = new Date(before).getUTCFullYear();

    expect(startYear).toBe(nowYear - 1);
    expect(endYear).toBe(nowYear + 2);
    expect(new Date(range.start).getTime()).toBeLessThanOrEqual(before);
    expect(new Date(range.end).getTime()).toBeGreaterThanOrEqual(after);
  });
});

describe("providerSupportsRecurrenceCreation", () => {
  it("is true only for Google, not Outlook, Apple, ICS, or an unselected source", () => {
    expect(providerSupportsRecurrenceCreation("google")).toBe(true);
    expect(providerSupportsRecurrenceCreation("outlook")).toBe(false);
    expect(providerSupportsRecurrenceCreation("apple")).toBe(false);
    expect(providerSupportsRecurrenceCreation("ics")).toBe(false);
    expect(providerSupportsRecurrenceCreation(undefined)).toBe(false);
  });
});
