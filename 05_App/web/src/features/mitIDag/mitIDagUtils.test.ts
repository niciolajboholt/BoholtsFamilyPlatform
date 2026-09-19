import { describe, expect, it } from "vitest";

import { familyPseudoMemberId, type CalendarEvent } from "../calendar/models/calendarEvent";
import type { TaskDto } from "../tasks/tasksApi";
import {
  buildMitIDagPlan,
  getMitIDagEvents,
  getMitIDagTasks,
  localDateKey,
} from "./mitIDagUtils";

function event(
  id: string,
  ownerIds: string[],
  options: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    title: id,
    start: "2026-09-19T10:00:00.000Z",
    end: "2026-09-19T11:00:00.000Z",
    allDay: false,
    ownerIds,
    source: "google",
    sourceId: "google:calendar",
    ...options,
  };
}

function task(id: string, assignedMemberId: string | null, isDone = 0): TaskDto {
  return {
    id,
    familyId: "family-1",
    name: id,
    icon: "fritid",
    assignedMemberId,
    timeOfDay: null,
    isDone,
    routineItemId: null,
    taskDate: "2026-09-19",
    createdByUserId: "user-1",
    createdAt: "2026-09-19T08:00:00.000Z",
    doneAt: null,
    rewardAmount: 0,
  };
}

describe("Mit i dag", () => {
  it("viser egne, flerpersoners og fælles aftaler, men ikke andres eller utildelte", () => {
    const events = [
      event("own", ["child"]),
      event("multi", ["adult", "child"]),
      event("family", [familyPseudoMemberId]),
      event("other", ["adult"]),
      event("unassigned", []),
    ];

    expect(getMitIDagEvents(events, "child", "adult").map(({ id }) => id)).toEqual([
      "own",
      "multi",
      "family",
    ]);
  });

  it("redigerer private detaljer ud fra den faktiske seer, ikke den valgte profil", () => {
    const privateEvent = event("private", ["child"], {
      title: "Fortrolig aftale",
      description: "Må ikke deles",
      location: "Hemmelig lokation",
      privacy: "busy",
    });

    expect(getMitIDagEvents([privateEvent], "child", "adult")[0]).toMatchObject({
      title: "Optaget",
      description: undefined,
      location: undefined,
      privacyRedacted: true,
    });
    expect(getMitIDagEvents([privateEvent], "child", "child")[0]?.title).toBe(
      "Fortrolig aftale",
    );
  });

  it("viser både personlige og familie-rettede opgaver", () => {
    const tasks = [task("own", "child"), task("family", null), task("other", "adult")];

    expect(getMitIDagTasks(tasks, "child").map(({ id }) => id)).toEqual([
      "own",
      "family",
    ]);
  });

  it("fjerner afsluttede aftaler fra næste aktivitet, når tiden går", () => {
    const events = [
      event("finished", ["child"], {
        start: "2026-09-19T08:00:00.000Z",
        end: "2026-09-19T09:00:00.000Z",
      }),
      event("upcoming", ["child"], {
        start: "2026-09-19T10:00:00.000Z",
        end: "2026-09-19T11:00:00.000Z",
      }),
    ];

    expect(buildMitIDagPlan(events, [], new Date("2026-09-19T09:30:00.000Z")).nextEvent?.id).toBe(
      "upcoming",
    );
    expect(buildMitIDagPlan(events, [], new Date("2026-09-19T11:01:00.000Z")).nextEvent).toBeNull();
  });

  it("bruger første ufærdige opgave, når der ikke er en kommende aftale", () => {
    const tasks = [task("done", "child", 1), task("next", "child")];
    const plan = buildMitIDagPlan([], tasks, new Date("2026-09-19T09:30:00.000Z"));

    expect(plan.nextTask?.id).toBe("next");
    expect(plan.restOfDayTasks.map(({ id }) => id)).toEqual(["done"]);
  });

  it("laver en lokal datonøgle til remount ved midnat", () => {
    expect(localDateKey(new Date(2026, 8, 9, 23, 59))).toBe("2026-09-09");
  });
});
