// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { getLocalCalendarSources } from "./localCalendarSources";
import { setCalendarMemberMapping } from "../preferences/calendarMemberMappingStorage";

describe("getLocalCalendarSources", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("includes a local source for every seeded family member by default", () => {
    const sources = getLocalCalendarSources();
    const ownerIds = sources.map((source) => source.ownerId).filter(Boolean);

    expect(ownerIds).toEqual(
      expect.arrayContaining(["nicolaj", "christine", "alfred", "jens", "family"]),
    );
  });

  it("hides the local source for a member mapped to a Google calendar (ADR-014)", () => {
    setCalendarMemberMapping("alfred@group.calendar.google.com", "alfred");

    const sources = getLocalCalendarSources();

    expect(sources.some((source) => source.id === "local:alfred")).toBe(false);
    // Other members are unaffected.
    expect(sources.some((source) => source.id === "local:christine")).toBe(true);
  });

  it("still includes the read-only legacy demo source regardless of mappings", () => {
    setCalendarMemberMapping("alfred@group.calendar.google.com", "alfred");

    const sources = getLocalCalendarSources();

    expect(sources.some((source) => source.id === "google:demo")).toBe(true);
  });
});
