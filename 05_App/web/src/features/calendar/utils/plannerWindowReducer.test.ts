import { describe, expect, it } from "vitest";

import {
  EXTEND_CHUNK_WEEKS,
  INITIAL_WEEKS_BACK,
  INITIAL_WEEKS_FORWARD,
  buildInitialWindow,
  weeksBetween,
  windowReducer,
} from "./plannerWindowReducer";

// Monday.
const centerDate = new Date(2026, 7, 3);

describe("buildInitialWindow", () => {
  it("spans the configured number of weeks back and forward from the center date's week", () => {
    const window = buildInitialWindow(centerDate);

    expect(weeksBetween(window.start, window.end)).toBe(
      INITIAL_WEEKS_BACK + INITIAL_WEEKS_FORWARD + 1,
    );
  });

  it("includes the center date itself", () => {
    const window = buildInitialWindow(centerDate);

    expect(window.start.getTime()).toBeLessThanOrEqual(centerDate.getTime());
    expect(window.end.getTime()).toBeGreaterThan(centerDate.getTime());
  });
});

describe("windowReducer", () => {
  it("extends the window backward by the fixed chunk size", () => {
    const initial = buildInitialWindow(centerDate);
    const next = windowReducer(initial, { type: "extend-backward" });

    expect(next.end).toEqual(initial.end);
    expect(weeksBetween(next.start, initial.start)).toBe(EXTEND_CHUNK_WEEKS);
  });

  it("extends the window forward by the fixed chunk size", () => {
    const initial = buildInitialWindow(centerDate);
    const next = windowReducer(initial, { type: "extend-forward" });

    expect(next.start).toEqual(initial.start);
    expect(weeksBetween(initial.end, next.end)).toBe(EXTEND_CHUNK_WEEKS);
  });

  it("stops extending once the window reaches the maximum total size", () => {
    let window = buildInitialWindow(centerDate);

    for (let i = 0; i < 100; i += 1) {
      window = windowReducer(window, { type: "extend-forward" });
    }

    const capped = weeksBetween(window.start, window.end);
    const onceMore = windowReducer(window, { type: "extend-forward" });

    expect(weeksBetween(onceMore.start, onceMore.end)).toBe(capped);
  });

  it("does not change the window when reanchoring to a date already inside it", () => {
    const initial = buildInitialWindow(centerDate);
    const nearbyDate = new Date(2026, 7, 10);

    const next = windowReducer(initial, {
      type: "reanchor",
      centerDate: nearbyDate,
    });

    expect(next).toEqual(initial);
  });

  it("rebuilds the window around a date far outside the current range", () => {
    const initial = buildInitialWindow(centerDate);
    const farDate = new Date(2027, 2, 1);

    const next = windowReducer(initial, {
      type: "reanchor",
      centerDate: farDate,
    });

    expect(next).not.toEqual(initial);
    expect(next.start.getTime()).toBeLessThanOrEqual(farDate.getTime());
    expect(next.end.getTime()).toBeGreaterThan(farDate.getTime());
  });
});
