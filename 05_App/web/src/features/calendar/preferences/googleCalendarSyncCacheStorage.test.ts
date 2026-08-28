// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import {
  clearCachedCalendarSyncState,
  getCachedCalendarSyncState,
  isCacheEntryFresh,
  listCachedCalendarSyncEntries,
  OFFLINE_CACHE_MAX_AGE_MS,
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

  it("round-trips events and syncToken, stamping updatedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"));

    setCachedCalendarSyncState("cal-1", { events: [anEvent], syncToken: "token-1" });

    expect(getCachedCalendarSyncState("cal-1")).toEqual({
      events: [anEvent],
      syncToken: "token-1",
      updatedAt: "2026-08-20T12:00:00.000Z",
    });

    vi.useRealTimers();
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

  it("falls back to undefined when a pre-Fase-8 entry has no updatedAt", () => {
    window.localStorage.setItem(
      "boholts-family-google-sync-cache:cal-1",
      JSON.stringify({ events: [anEvent], syncToken: "token-1" }),
    );

    expect(getCachedCalendarSyncState("cal-1")).toBeUndefined();
  });

  describe("listCachedCalendarSyncEntries", () => {
    it("lists every cached calendar, ignoring unrelated localStorage keys", () => {
      setCachedCalendarSyncState("cal-1", { events: [anEvent], syncToken: "token-1" });
      setCachedCalendarSyncState("cal-2", { events: [], syncToken: "token-2" });
      window.localStorage.setItem("some-other-app-key", "irrelevant");

      const entries = listCachedCalendarSyncEntries();

      expect(entries).toHaveLength(2);
      expect(entries.map((entry) => entry.calendarId).sort()).toEqual(["cal-1", "cal-2"]);
    });

    it("returns an empty list when nothing is cached", () => {
      expect(listCachedCalendarSyncEntries()).toEqual([]);
    });
  });

  describe("isCacheEntryFresh", () => {
    const now = new Date("2026-08-20T12:00:00.000Z").getTime();

    it("is fresh exactly at the 7-day boundary", () => {
      const updatedAt = new Date(now - OFFLINE_CACHE_MAX_AGE_MS).toISOString();
      expect(isCacheEntryFresh(updatedAt, now)).toBe(true);
    });

    it("is stale just past the 7-day boundary", () => {
      const updatedAt = new Date(now - OFFLINE_CACHE_MAX_AGE_MS - 1).toISOString();
      expect(isCacheEntryFresh(updatedAt, now)).toBe(false);
    });

    it("is not fresh when undefined or malformed", () => {
      expect(isCacheEntryFresh(undefined, now)).toBe(false);
      expect(isCacheEntryFresh("not a date", now)).toBe(false);
    });
  });
});

afterEach(() => {
  vi.useRealTimers();
});
