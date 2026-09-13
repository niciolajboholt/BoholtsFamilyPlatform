// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearExcludedOutlookCalendars,
  getExcludedOutlookCalendarIds,
  setExcludedOutlookCalendars,
} from "./outlookCalendarExclusionStorage";

describe("outlookCalendarExclusionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getExcludedOutlookCalendarIds()).toEqual([]);
  });

  it("round-trips excluded calendar ids", () => {
    setExcludedOutlookCalendars(["AAMkAGI2-example-calendar-id"]);

    expect(getExcludedOutlookCalendarIds()).toEqual([
      "AAMkAGI2-example-calendar-id",
    ]);
  });

  it("replaces the previous exclusion list rather than accumulating", () => {
    setExcludedOutlookCalendars(["calendar-a"]);
    setExcludedOutlookCalendars(["calendar-b"]);

    expect(getExcludedOutlookCalendarIds()).toEqual(["calendar-b"]);
  });

  it("de-duplicates ids within a single call", () => {
    setExcludedOutlookCalendars(["calendar-a", "calendar-a"]);

    expect(getExcludedOutlookCalendarIds()).toEqual(["calendar-a"]);
  });

  it("clearExcludedOutlookCalendars empties the list", () => {
    setExcludedOutlookCalendars(["calendar-a"]);
    clearExcludedOutlookCalendars();

    expect(getExcludedOutlookCalendarIds()).toEqual([]);
  });

  it("falls back to an empty list when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-outlook-excluded-calendars",
      "not valid json {{{",
    );

    expect(getExcludedOutlookCalendarIds()).toEqual([]);
  });
});
