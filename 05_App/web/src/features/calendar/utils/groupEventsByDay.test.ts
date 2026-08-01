import { describe, expect, it } from "vitest";

import { getDayKey, groupEventsByDay } from "./groupEventsByDay";
import type { CalendarEvent } from "../models/calendarEvent";

function buildEvent(
  id: string,
  start: Date,
  end: Date,
  allDay = false,
): CalendarEvent {
  return {
    id,
    title: id,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    ownerIds: ["nicolaj"],
    source: "internal",
    sourceId: "local",
  };
}

describe("groupEventsByDay", () => {
  it("puts a single-day timed event under its own day", () => {
    const event = buildEvent(
      "a",
      new Date(2026, 7, 3, 9, 0),
      new Date(2026, 7, 3, 10, 0),
    );

    const grouped = groupEventsByDay([event]);

    expect(grouped.get(getDayKey(new Date(2026, 7, 3)))).toEqual([event]);
    expect(grouped.size).toBe(1);
  });

  it("repeats a multi-day event across every day it overlaps", () => {
    const event = buildEvent(
      "trip",
      new Date(2026, 7, 3, 9, 0),
      new Date(2026, 7, 5, 12, 0),
    );

    const grouped = groupEventsByDay([event]);

    expect(grouped.get(getDayKey(new Date(2026, 7, 3)))).toEqual([event]);
    expect(grouped.get(getDayKey(new Date(2026, 7, 4)))).toEqual([event]);
    expect(grouped.get(getDayKey(new Date(2026, 7, 5)))).toEqual([event]);
    expect(grouped.size).toBe(3);
  });

  it("treats an all-day event's end date as exclusive, like getEventsForDate", () => {
    // Heldagsaftaler gemmes med en eksklusiv slutdato (samme konvention som
    // getEventsForDate.ts) — en 1-dags heldagsaftale den 3. har end = 4. kl 00.
    const event = buildEvent(
      "holiday",
      new Date(2026, 7, 3),
      new Date(2026, 7, 4),
      true,
    );

    const grouped = groupEventsByDay([event]);

    expect(grouped.size).toBe(1);
    expect(grouped.get(getDayKey(new Date(2026, 7, 3)))).toEqual([event]);
  });

  it("groups multiple events on the same day together", () => {
    const first = buildEvent(
      "first",
      new Date(2026, 7, 3, 9, 0),
      new Date(2026, 7, 3, 10, 0),
    );

    const second = buildEvent(
      "second",
      new Date(2026, 7, 3, 14, 0),
      new Date(2026, 7, 3, 15, 0),
    );

    const grouped = groupEventsByDay([first, second]);

    expect(grouped.get(getDayKey(new Date(2026, 7, 3)))).toEqual([
      first,
      second,
    ]);
  });

  it("ignores events with invalid dates", () => {
    const invalid: CalendarEvent = {
      id: "invalid",
      title: "invalid",
      start: "not-a-date",
      end: new Date().toISOString(),
      allDay: false,
      ownerIds: ["nicolaj"],
      source: "internal",
      sourceId: "local",
    };

    const grouped = groupEventsByDay([invalid]);

    expect(grouped.size).toBe(0);
  });
});
