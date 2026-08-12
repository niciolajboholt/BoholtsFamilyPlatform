// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { getLocalCalendarSources } from "./localCalendarSources";

// getLocalCalendarSources() reads calendarMemberMappingStorage's synchronous
// local cache directly — seeded here via the same storage key/shape instead
// of going through setCalendarMemberMapping(), which is async and
// server-first as of Fase 4 (covered by its own test file).
const MAPPING_STORAGE_KEY = "boholts-family-calendar-member-mapping";

function seedMapping(googleCalendarId: string, ownerId: string) {
  window.localStorage.setItem(
    MAPPING_STORAGE_KEY,
    JSON.stringify([{ googleCalendarId, ownerId }]),
  );
}

describe("getLocalCalendarSources", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("includes a local source for every seeded family member by default", () => {
    const sources = getLocalCalendarSources();
    const ownerIds = sources.map((source) => source.ownerId).filter(Boolean);

    expect(ownerIds).toEqual(
      expect.arrayContaining(["far", "mor", "barn-1", "barn-2", "family"]),
    );
  });

  it("hides the local source for a member mapped to a Google calendar (ADR-014)", () => {
    seedMapping("barn-1@group.calendar.google.com", "barn-1");

    const sources = getLocalCalendarSources();

    expect(sources.some((source) => source.id === "local:barn-1")).toBe(false);
    // Other members are unaffected.
    expect(sources.some((source) => source.id === "local:mor")).toBe(true);
  });

  it("still includes the read-only legacy demo source regardless of mappings", () => {
    seedMapping("barn-1@group.calendar.google.com", "barn-1");

    const sources = getLocalCalendarSources();

    expect(sources.some((source) => source.id === "google:demo")).toBe(true);
  });
});
