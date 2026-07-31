// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  getCalendarMemberMappings,
  getOwnerIdForGoogleCalendar,
  setCalendarMemberMapping,
} from "./calendarMemberMappingStorage";

describe("calendarMemberMappingStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns nothing for an unmapped calendar", () => {
    expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBeUndefined();
    expect(getCalendarMemberMappings()).toEqual({});
  });

  it("round-trips a mapping", () => {
    setCalendarMemberMapping("nicolajbach12@gmail.com", "nicolaj");

    expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBe("nicolaj");
    expect(getCalendarMemberMappings()).toEqual({
      "nicolajbach12@gmail.com": "nicolaj",
    });
  });

  it("replaces an existing mapping for the same calendar rather than duplicating it", () => {
    setCalendarMemberMapping("familien-boholt@group.calendar.google.com", "nicolaj");
    setCalendarMemberMapping("familien-boholt@group.calendar.google.com", "family");

    expect(getOwnerIdForGoogleCalendar("familien-boholt@group.calendar.google.com")).toBe(
      "family",
    );
    expect(Object.keys(getCalendarMemberMappings())).toHaveLength(1);
  });

  it("removes a mapping when set to null", () => {
    setCalendarMemberMapping("nicolajbach12@gmail.com", "nicolaj");
    setCalendarMemberMapping("nicolajbach12@gmail.com", null);

    expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBeUndefined();
  });

  it("keeps other calendars' mappings untouched", () => {
    setCalendarMemberMapping("nicolajbach12@gmail.com", "nicolaj");
    setCalendarMemberMapping("alfred@group.calendar.google.com", "alfred");
    setCalendarMemberMapping("nicolajbach12@gmail.com", null);

    expect(getOwnerIdForGoogleCalendar("alfred@group.calendar.google.com")).toBe("alfred");
    expect(getOwnerIdForGoogleCalendar("nicolajbach12@gmail.com")).toBeUndefined();
  });

  it("falls back to empty when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-calendar-member-mapping",
      "not valid json {{{",
    );

    expect(getCalendarMemberMappings()).toEqual({});
  });
});
