// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { CalendarSource } from "../models/calendarProvider";
import {
  getVisibleCalendarSourceIds,
  hideCalendarSources,
  saveVisibleCalendarSourceIds,
} from "./calendarSourceVisibilityStorage";

function buildSource(
  overrides: Partial<CalendarSource> = {},
): CalendarSource {
  return {
    id: "local:family",
    name: "Familien",
    providerType: "local",
    color: "#6D597A",
    isVisible: true,
    isReadOnly: false,
    ...overrides,
  };
}

describe("calendarSourceVisibilityStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("treats every source as visible when nothing is stored", () => {
    const sources = [
      buildSource({ id: "local:family" }),
      buildSource({ id: "google:abc" }),
    ];

    expect(getVisibleCalendarSourceIds(sources)).toEqual([
      "local:family",
      "google:abc",
    ]);
  });

  it("round-trips a manually hidden source", () => {
    const sources = [
      buildSource({ id: "local:family" }),
      buildSource({ id: "google:abc" }),
    ];

    saveVisibleCalendarSourceIds(sources, ["local:family"]);

    expect(getVisibleCalendarSourceIds(sources)).toEqual(["local:family"]);
  });

  it("hideCalendarSources hides only the given ids, without touching other hidden sources", () => {
    const sources = [
      buildSource({ id: "local:family" }),
      buildSource({ id: "local:jens" }),
      buildSource({ id: "google:birthdays" }),
      buildSource({ id: "google:tasks" }),
    ];

    // "jens" is already hidden from an earlier, unrelated manual toggle.
    saveVisibleCalendarSourceIds(sources, [
      "local:family",
      "google:birthdays",
      "google:tasks",
    ]);

    // The new Google-connect selection dialog hides two more sources.
    hideCalendarSources(["google:birthdays", "google:tasks"]);

    expect(getVisibleCalendarSourceIds(sources)).toEqual(["local:family"]);
  });

  it("hideCalendarSources is a no-op for ids that are already hidden", () => {
    const sources = [
      buildSource({ id: "local:family" }),
      buildSource({ id: "google:birthdays" }),
    ];

    hideCalendarSources(["google:birthdays"]);
    hideCalendarSources(["google:birthdays"]);

    expect(getVisibleCalendarSourceIds(sources)).toEqual(["local:family"]);
  });
});
