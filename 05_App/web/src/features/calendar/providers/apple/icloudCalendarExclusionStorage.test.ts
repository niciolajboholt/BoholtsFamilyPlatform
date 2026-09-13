// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearExcludedIcloudCalendars,
  clearExcludedIcloudCalendarsForConnection,
  getExcludedIcloudCalendarSourceIds,
  setExcludedIcloudCalendars,
} from "./icloudCalendarExclusionStorage";
import { encodeIcloudCalendarSourceId } from "./icloudCalendarIds";

describe("icloudCalendarExclusionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getExcludedIcloudCalendarSourceIds()).toEqual([]);
  });

  it("round-trips excluded source ids", () => {
    const sourceId = encodeIcloudCalendarSourceId("conn-1", "https://caldav.icloud.com/1/calendars/home/");
    setExcludedIcloudCalendars([sourceId]);

    expect(getExcludedIcloudCalendarSourceIds()).toEqual([sourceId]);
  });

  it("replaces the previous exclusion list rather than accumulating", () => {
    setExcludedIcloudCalendars(["icloud:a:x"]);
    setExcludedIcloudCalendars(["icloud:b:y"]);

    expect(getExcludedIcloudCalendarSourceIds()).toEqual(["icloud:b:y"]);
  });

  it("de-duplicates ids within a single call", () => {
    setExcludedIcloudCalendars(["icloud:a:x", "icloud:a:x"]);

    expect(getExcludedIcloudCalendarSourceIds()).toEqual(["icloud:a:x"]);
  });

  it("clearExcludedIcloudCalendars empties the whole list", () => {
    setExcludedIcloudCalendars(["icloud:a:x"]);
    clearExcludedIcloudCalendars();

    expect(getExcludedIcloudCalendarSourceIds()).toEqual([]);
  });

  it("falls back to an empty list when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-icloud-excluded-calendars",
      "not valid json {{{",
    );

    expect(getExcludedIcloudCalendarSourceIds()).toEqual([]);
  });

  it("clearExcludedIcloudCalendarsForConnection only removes that connection's own entries", () => {
    const connAId = encodeIcloudCalendarSourceId("conn-a", "https://caldav.icloud.com/1/calendars/home/");
    const connBId = encodeIcloudCalendarSourceId("conn-b", "https://caldav.icloud.com/2/calendars/home/");
    setExcludedIcloudCalendars([connAId, connBId]);

    clearExcludedIcloudCalendarsForConnection("conn-a");

    expect(getExcludedIcloudCalendarSourceIds()).toEqual([connBId]);
  });
});
