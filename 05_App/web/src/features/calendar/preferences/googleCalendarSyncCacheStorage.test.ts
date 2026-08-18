// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import {
  clearCachedCalendarSyncState,
  getCachedCalendarSyncState,
  setCachedCalendarSyncState,
} from "./googleCalendarSyncCacheStorage";

const anEvent: CalendarEvent = {
  id: "google-event:cal-1:evt-1",
  title: "Tandlæge",
  start: "2026-08-20T10:00:00.000Z",
  end: "2026-08-20T10:30:00.000Z",
  allDay: false,
  ownerIds: [],
  source: "google",
  sourceId: "google:cal-1",
};

describe("googleCalendarSyncCacheStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns undefined when nothing is cached", () => {
    expect(getCachedCalendarSyncState("cal-1")).toBeUndefined();
  });

  it("round-trips events and syncToken", () => {
    setCachedCalendarSyncState("cal-1", { events: [anEvent], syncToken: "token-1" });

    expect(getCachedCalendarSyncState("cal-1")).toEqual({
      events: [anEvent],
      syncToken: "token-1",
    });
  });

  it("keeps different calendar ids separate", () => {
    setCachedCalendarSyncState("cal-1", { events: [anEvent], syncToken: "token-1" });
    setCachedCalendarSyncState("cal-2", { events: [], syncToken: "token-2" });

    expect(getCachedCalendarSyncState("cal-1")?.syncToken).toBe("token-1");
    expect(getCachedCalendarSyncState("cal-2")?.syncToken).toBe("token-2");
  });

  it("clearCachedCalendarSyncState removes only the given calendar", () => {
    setCachedCalendarSyncState("cal-1", { events: [anEvent], syncToken: "token-1" });
    setCachedCalendarSyncState("cal-2", { events: [], syncToken: "token-2" });

    clearCachedCalendarSyncState("cal-1");

    expect(getCachedCalendarSyncState("cal-1")).toBeUndefined();
    expect(getCachedCalendarSyncState("cal-2")).toBeDefined();
  });

  it("falls back to undefined when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-google-sync-cache:cal-1",
      "not valid json {{{",
    );

    expect(getCachedCalendarSyncState("cal-1")).toBeUndefined();
  });

  it("falls back to undefined when storage holds a differently-shaped object", () => {
    window.localStorage.setItem(
      "boholts-family-google-sync-cache:cal-1",
      JSON.stringify({ foo: "bar" }),
    );

    expect(getCachedCalendarSyncState("cal-1")).toBeUndefined();
  });
});
