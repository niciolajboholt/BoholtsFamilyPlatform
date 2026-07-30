// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearExcludedGoogleCalendars,
  excludeGoogleCalendars,
  getExcludedGoogleCalendarIds,
} from "./googleCalendarExclusionStorage";

describe("googleCalendarExclusionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getExcludedGoogleCalendarIds()).toEqual([]);
  });

  it("round-trips excluded calendar ids", () => {
    excludeGoogleCalendars(["da.danish#holiday@group.v.calendar.google.com"]);

    expect(getExcludedGoogleCalendarIds()).toEqual([
      "da.danish#holiday@group.v.calendar.google.com",
    ]);
  });

  it("accumulates across multiple calls without duplicating", () => {
    excludeGoogleCalendars(["holidays@group.v.calendar.google.com"]);
    excludeGoogleCalendars([
      "holidays@group.v.calendar.google.com",
      "weeknumbers@group.v.calendar.google.com",
    ]);

    expect(getExcludedGoogleCalendarIds().sort()).toEqual([
      "holidays@group.v.calendar.google.com",
      "weeknumbers@group.v.calendar.google.com",
    ]);
  });

  it("clearExcludedGoogleCalendars empties the list", () => {
    excludeGoogleCalendars(["holidays@group.v.calendar.google.com"]);
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
