// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearFavoriteCalendarView,
  getFavoriteCalendarView,
  setFavoriteCalendarView,
} from "./calendarFavoriteViewStorage";

describe("calendarFavoriteViewStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getFavoriteCalendarView("nicolaj")).toBeNull();
  });

  it("returns null for a null member id", () => {
    expect(getFavoriteCalendarView(null)).toBeNull();
  });

  it("round-trips a saved favorite", () => {
    setFavoriteCalendarView("nicolaj", "planner");

    expect(getFavoriteCalendarView("nicolaj")).toBe("planner");
  });

  it("keeps favorites separate per member", () => {
    setFavoriteCalendarView("nicolaj", "planner");
    setFavoriteCalendarView("alex", "week");

    expect(getFavoriteCalendarView("nicolaj")).toBe("planner");
    expect(getFavoriteCalendarView("alex")).toBe("week");
  });

  it("overwrites a member's previous favorite", () => {
    setFavoriteCalendarView("nicolaj", "planner");
    setFavoriteCalendarView("nicolaj", "day");

    expect(getFavoriteCalendarView("nicolaj")).toBe("day");
  });

  it("clears a member's favorite without touching others", () => {
    setFavoriteCalendarView("nicolaj", "planner");
    setFavoriteCalendarView("alex", "week");

    clearFavoriteCalendarView("nicolaj");

    expect(getFavoriteCalendarView("nicolaj")).toBeNull();
    expect(getFavoriteCalendarView("alex")).toBe("week");
  });

  it("falls back to nothing stored when storage holds invalid JSON", () => {
    window.localStorage.setItem("boholts-calendar-favorite-view", "not valid json {{{");

    expect(getFavoriteCalendarView("nicolaj")).toBeNull();
  });

  it("ignores an invalid stored view value", () => {
    window.localStorage.setItem(
      "boholts-calendar-favorite-view",
      JSON.stringify({ nicolaj: "not-a-real-view" }),
    );

    expect(getFavoriteCalendarView("nicolaj")).toBeNull();
  });
});
