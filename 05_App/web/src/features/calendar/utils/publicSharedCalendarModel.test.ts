import { describe, expect, it } from "vitest";

import { addMonths, startOfMonth, toCalendarModel, toMonthNavBounds } from "./publicSharedCalendarModel";

describe("toCalendarModel", () => {
  it("maps events and de-duplicates members by name", () => {
    const model = toCalendarModel([
      {
        title: "Fodbold",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
      {
        title: "Svømning",
        start: "2026-08-21T10:00:00.000Z",
        end: "2026-08-21T11:00:00.000Z",
        allDay: false,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
      {
        title: "Ballet",
        start: "2026-08-22T10:00:00.000Z",
        end: "2026-08-22T11:00:00.000Z",
        allDay: false,
        memberName: "Freja",
        memberColor: "#C06C84",
      },
    ]);

    expect(model.members).toHaveLength(2);
    expect(model.members.map((member) => member.name).sort()).toEqual(["Alfred", "Freja"]);
    expect(model.events).toHaveLength(3);
    expect(model.events[0].ownerIds).toEqual([
      model.members.find((member) => member.name === "Alfred")?.id,
    ]);
  });

  it("gives each mapped event a unique id", () => {
    const model = toCalendarModel([
      {
        title: "A",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
      {
        title: "B",
        start: "2026-08-20T12:00:00.000Z",
        end: "2026-08-20T13:00:00.000Z",
        allDay: false,
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);

    expect(new Set(model.events.map((event) => event.id)).size).toBe(2);
  });

  it("preserves title, times, location and description", () => {
    const model = toCalendarModel([
      {
        title: "Fødselsdag",
        start: "2026-08-20T10:00:00.000Z",
        end: "2026-08-20T11:00:00.000Z",
        allDay: false,
        location: "Skolen",
        description: "Husk gave",
        memberName: "Alfred",
        memberColor: "#2E7D32",
      },
    ]);

    expect(model.events[0]).toMatchObject({
      title: "Fødselsdag",
      start: "2026-08-20T10:00:00.000Z",
      end: "2026-08-20T11:00:00.000Z",
      location: "Skolen",
      description: "Husk gave",
    });
  });
});

describe("toMonthNavBounds", () => {
  it("returns the previous and next calendar month relative to the reference date", () => {
    const bounds = toMonthNavBounds(new Date("2026-08-20T00:00:00.000Z"));

    expect(bounds.min).toEqual(startOfMonth(new Date("2026-07-01T00:00:00.000Z")));
    expect(bounds.max).toEqual(startOfMonth(new Date("2026-09-01T00:00:00.000Z")));
  });
});

describe("addMonths / startOfMonth", () => {
  it("addMonths steps by whole calendar months", () => {
    expect(addMonths(new Date(2026, 7, 15), 1)).toEqual(new Date(2026, 8, 1));
    expect(addMonths(new Date(2026, 7, 15), -1)).toEqual(new Date(2026, 6, 1));
  });

  it("startOfMonth truncates to the 1st", () => {
    expect(startOfMonth(new Date(2026, 7, 20, 13, 45))).toEqual(new Date(2026, 7, 1));
  });
});
