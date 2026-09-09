import { describe, expect, it } from "vitest";

import { daysUntilNextBirthday, isValidMonthDay } from "./birthday";

describe("isValidMonthDay", () => {
  it("accepts valid month-day strings", () => {
    expect(isValidMonthDay("01-01")).toBe(true);
    expect(isValidMonthDay("12-31")).toBe(true);
    expect(isValidMonthDay("06-15")).toBe(true);
  });

  it("rejects invalid formats and out-of-range values", () => {
    expect(isValidMonthDay("13-01")).toBe(false);
    expect(isValidMonthDay("00-15")).toBe(false);
    expect(isValidMonthDay("06-32")).toBe(false);
    expect(isValidMonthDay("06-00")).toBe(false);
    expect(isValidMonthDay("2026-06-15")).toBe(false);
    expect(isValidMonthDay("6-15")).toBe(false);
    expect(isValidMonthDay("not-a-date")).toBe(false);
  });
});

describe("daysUntilNextBirthday", () => {
  it("returns 0 when the birthday is today", () => {
    expect(daysUntilNextBirthday("06-15", new Date("2026-06-15T12:00:00Z"))).toBe(0);
  });

  it("counts forward within the same year", () => {
    expect(daysUntilNextBirthday("06-22", new Date("2026-06-15T00:00:00Z"))).toBe(7);
  });

  it("wraps to next year when the birthday has already passed this year", () => {
    // 2026-06-15 -> næste 01-01 er i 2027, ikke "for 165 dage siden".
    expect(daysUntilNextBirthday("01-01", new Date("2026-06-15T00:00:00Z"))).toBe(
      Math.round(
        (Date.UTC(2027, 0, 1) - Date.UTC(2026, 5, 15)) / (24 * 60 * 60 * 1000),
      ),
    );
  });

  it("is unaffected by the time-of-day component of 'today'", () => {
    const morning = daysUntilNextBirthday("06-22", new Date("2026-06-15T00:05:00Z"));
    const evening = daysUntilNextBirthday("06-22", new Date("2026-06-15T23:55:00Z"));
    expect(morning).toBe(evening);
  });
});
