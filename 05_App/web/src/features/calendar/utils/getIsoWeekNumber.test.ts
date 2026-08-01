import { describe, expect, it } from "vitest";

import { getIsoWeekNumber } from "./getIsoWeekNumber";

describe("getIsoWeekNumber", () => {
  it("returns week 1 for a date early in January that belongs to week 1", () => {
    expect(getIsoWeekNumber(new Date(2026, 0, 1))).toBe(1);
  });

  it("returns the correct mid-year week number", () => {
    // Monday 2026-08-03 is ISO week 32.
    expect(getIsoWeekNumber(new Date(2026, 7, 3))).toBe(32);
  });

  it("assigns the last days of December to week 1 of the following year when applicable", () => {
    // 2025-12-29 (Monday) is ISO week 1 of 2026.
    expect(getIsoWeekNumber(new Date(2025, 11, 29))).toBe(1);
  });
});
