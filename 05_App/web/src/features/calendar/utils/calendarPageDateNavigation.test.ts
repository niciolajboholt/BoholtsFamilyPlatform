import { afterEach, describe, expect, it, vi } from "vitest";

import {
  changeDay,
  changeMonth,
  changeWeek,
  getDefaultCalendarView,
  getTodayCalendarDate,
  getVisibleRange,
  startOfMonth,
} from "./calendarPageDateNavigation";

describe("getTodayCalendarDate", () => {
  it("returns today's date normalized to noon", () => {
    const result = getTodayCalendarDate();
    const now = new Date();

    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });
});

describe("startOfMonth", () => {
  it("returns the first day of the given date's month at noon", () => {
    const result = startOfMonth(new Date(2026, 7, 27, 18, 30));

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(12);
  });
});

describe("changeMonth", () => {
  it("moves forward across a year boundary", () => {
    const result = changeMonth(new Date(2026, 11, 15, 9, 0), 1);

    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("moves backward across a year boundary", () => {
    const result = changeMonth(new Date(2026, 0, 15, 9, 0), -1);

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
  });
});

describe("changeWeek", () => {
  it("adds seven days per week without mutating the input", () => {
    const input = new Date(2026, 7, 3, 9, 0);
    const result = changeWeek(input, 2);

    expect(input.getDate()).toBe(3);
    expect(result.getDate()).toBe(17);
    expect(result.getMonth()).toBe(7);
  });

  it("subtracts for negative offsets", () => {
    const result = changeWeek(new Date(2026, 7, 3, 9, 0), -1);

    expect(result.getDate()).toBe(27);
    expect(result.getMonth()).toBe(6);
  });
});

describe("changeDay", () => {
  it("adds days without mutating the input", () => {
    const input = new Date(2026, 7, 27, 9, 0);
    const result = changeDay(input, 5);

    expect(input.getDate()).toBe(27);
    expect(result.getDate()).toBe(1);
    expect(result.getMonth()).toBe(8);
  });
});

describe("getVisibleRange", () => {
  it("returns a week-view range spanning one week before and two weeks after", () => {
    const range = getVisibleRange(new Date(2026, 7, 10), "week");

    expect(new Date(range.start).getDate()).toBe(3);
    expect(new Date(range.end).getDate()).toBe(24);
  });

  it("returns a day-view range spanning three days before and four after", () => {
    const range = getVisibleRange(new Date(2026, 7, 10), "day");

    expect(new Date(range.start).getDate()).toBe(7);
    expect(new Date(range.end).getDate()).toBe(14);
  });

  it("returns a month-view range padded a week into each neighboring month", () => {
    const range = getVisibleRange(new Date(2026, 7, 10), "month");

    expect(new Date(range.start).getMonth()).toBe(6);
    expect(new Date(range.start).getDate()).toBe(25);
    expect(new Date(range.end).getMonth()).toBe(8);
    expect(new Date(range.end).getDate()).toBe(8);
  });

  it("falls back to the month-view range for the planner view", () => {
    const monthRange = getVisibleRange(new Date(2026, 7, 10), "month");
    const plannerRange = getVisibleRange(new Date(2026, 7, 10), "planner");

    expect(plannerRange).toEqual(monthRange);
  });
});

describe("getDefaultCalendarView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to month view when there is no window (SSR/build-time)", () => {
    expect(getDefaultCalendarView()).toBe("month");
  });

  it("starts in week view on a narrow (mobile) viewport", () => {
    vi.stubGlobal("window", { innerWidth: 375 });

    expect(getDefaultCalendarView()).toBe("week");
  });

  it("starts in month view on a wide (desktop) viewport", () => {
    vi.stubGlobal("window", { innerWidth: 1200 });

    expect(getDefaultCalendarView()).toBe("month");
  });
});
