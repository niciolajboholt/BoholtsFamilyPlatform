import { describe, expect, it } from "vitest";

import { layoutDayTimelineEvents } from "./layoutDayTimelineEvents";
import type { CalendarEvent } from "../models/calendarEvent";

const day = new Date(2026, 7, 3);

function buildEvent(
  id: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): CalendarEvent {
  return {
    id,
    title: id,
    start: new Date(2026, 7, 3, startHour, startMinute).toISOString(),
    end: new Date(2026, 7, 3, endHour, endMinute).toISOString(),
    allDay: false,
    ownerIds: ["nicolaj"],
    source: "internal",
    sourceId: "local",
  };
}

describe("layoutDayTimelineEvents", () => {
  it("gives non-overlapping events full width in a single column", () => {
    const events = [
      buildEvent("morning", 9, 0, 10, 0),
      buildEvent("afternoon", 14, 0, 15, 0),
    ];

    const layout = layoutDayTimelineEvents(events, day);

    expect(layout).toHaveLength(2);
    for (const entry of layout) {
      expect(entry.columnIndex).toBe(0);
      expect(entry.columnCount).toBe(1);
    }
  });

  it("splits two overlapping events into separate columns", () => {
    const events = [
      buildEvent("first", 9, 0, 10, 0),
      buildEvent("second", 9, 30, 10, 30),
    ];

    const layout = layoutDayTimelineEvents(events, day);
    const byId = new Map(layout.map((entry) => [entry.event.id, entry]));

    expect(byId.get("first")?.columnIndex).toBe(0);
    expect(byId.get("second")?.columnIndex).toBe(1);
    expect(byId.get("first")?.columnCount).toBe(2);
    expect(byId.get("second")?.columnCount).toBe(2);
  });

  it("reuses a freed-up column once its previous event has ended", () => {
    // A: 09:00–10:00, B: 09:30–10:30 (overlaps A), C: 10:15–11:00 (overlaps
    // B, but not A) — all three land in one transitively-linked cluster, and
    // C should be able to reuse A's column since A already ended by 10:00.
    const events = [
      buildEvent("a", 9, 0, 10, 0),
      buildEvent("b", 9, 30, 10, 30),
      buildEvent("c", 10, 15, 11, 0),
    ];

    const layout = layoutDayTimelineEvents(events, day);
    const byId = new Map(layout.map((entry) => [entry.event.id, entry]));

    expect(byId.get("a")?.columnIndex).toBe(0);
    expect(byId.get("b")?.columnIndex).toBe(1);
    expect(byId.get("c")?.columnIndex).toBe(0);
    expect(byId.get("a")?.columnCount).toBe(2);
    expect(byId.get("b")?.columnCount).toBe(2);
    expect(byId.get("c")?.columnCount).toBe(2);
  });

  it("computes top/height percentages from midnight", () => {
    const events = [buildEvent("noon", 12, 0, 13, 0)];

    const [entry] = layoutDayTimelineEvents(events, day);

    expect(entry.topPercent).toBeCloseTo(50, 5);
    expect(entry.heightPercent).toBeCloseTo((60 / 1440) * 100, 5);
  });

  it("clips an event that starts before this day to midnight", () => {
    const overnightEvent: CalendarEvent = {
      id: "overnight",
      title: "overnight",
      start: new Date(2026, 7, 2, 22, 0).toISOString(),
      end: new Date(2026, 7, 3, 6, 0).toISOString(),
      allDay: false,
      ownerIds: ["nicolaj"],
      source: "internal",
      sourceId: "local",
    };

    const [entry] = layoutDayTimelineEvents([overnightEvent], day);

    expect(entry.topPercent).toBe(0);
    expect(entry.heightPercent).toBeCloseTo((6 * 60 / 1440) * 100, 5);
  });

  it("gives a very short event a minimum visible duration", () => {
    const events = [buildEvent("quick", 9, 0, 9, 5)];

    const [entry] = layoutDayTimelineEvents(events, day);

    expect(entry.heightPercent).toBeCloseTo((20 / 1440) * 100, 5);
  });
});
