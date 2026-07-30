// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { CalendarSource } from "../models/calendarProvider";
import {
  getVisibleCalendarSourceIds,
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
});
