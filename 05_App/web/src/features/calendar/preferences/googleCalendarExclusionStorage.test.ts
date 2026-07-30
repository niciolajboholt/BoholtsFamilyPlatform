// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearExcludedGoogleCalendars,
  getExcludedGoogleCalendarIds,
  setExcludedGoogleCalendars,
} from "./googleCalendarExclusionStorage";

describe("googleCalendarExclusionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getExcludedGoogleCalendarIds()).toEqual([]);
  });

  it("round-trips excluded calendar ids", () => {
    setExcludedGoogleCalendars(["da.danish#holiday@group.v.calendar.google.com"]);

    expect(getExcludedGoogleCalendarIds()).toEqual([
      "da.danish#holiday@group.v.calendar.google.com",
    ]);
  });

  it("replaces the previous exclusion list rather than accumulating", () => {
    setExcludedGoogleCalendars(["holidays@group.v.calendar.google.com"]);
    setExcludedGoogleCalendars(["weeknumbers@group.v.calendar.google.com"]);

    expect(getExcludedGoogleCalendarIds()).toEqual([
      "weeknumbers@group.v.calendar.google.com",
    ]);
  });

  it("de-duplicates ids within a single call", () => {
    setExcludedGoogleCalendars([
      "holidays@group.v.calendar.google.com",
      "holidays@group.v.calendar.google.com",
    ]);

    expect(getExcludedGoogleCalendarIds()).toEqual([
      "holidays@group.v.calendar.google.com",
    ]);
  });

  it("clearExcludedGoogleCalendars empties the list", () => {
    setExcludedGoogleCalendars(["holidays@group.v.calendar.google.com"]);
    clearExcludedGoogleCalendars();

    expect(getExcludedGoogleCalendarIds()).toEqual([]);
  });

  it("falls back to an empty list when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-google-excluded-calendars",
      "not valid json {{{",
    );

    expect(getExcludedGoogleCalendarIds()).toEqual([]);
  });
});
