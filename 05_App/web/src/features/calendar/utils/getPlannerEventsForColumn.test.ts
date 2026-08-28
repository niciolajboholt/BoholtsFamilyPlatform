import { describe, expect, it } from "vitest";

import {
  familyPseudoMemberId,
  type CalendarEvent,
} from "../models/calendarEvent";
import { getPlannerEventsForColumn } from "./getPlannerEventsForColumn";

function event(id: string, ownerIds: string[]): CalendarEvent {
  return {
    id,
    title: id,
    start: "2026-08-26T08:00:00.000Z",
    end: "2026-08-26T09:00:00.000Z",
    allDay: false,
    ownerIds,
    source: "google",
    sourceId: "google:calendar",
  };
}

describe("getPlannerEventsForColumn", () => {
  const events = [
    event("anna", ["anna"]),
    event("bo", ["bo"]),
    event("shared", ["anna", "bo"]),
    event("family", [familyPseudoMemberId]),
    event("unassigned", []),
  ];

  it("viser kun enkelt-ejer-aftaler i personkolonnen", () => {
    expect(getPlannerEventsForColumn(events, "anna").map(({ id }) => id))
      .toEqual(["anna"]);
  });

  it("samler fælles og ikke-entydigt tildelte aftaler i familiekolonnen", () => {
    expect(
      getPlannerEventsForColumn(events, familyPseudoMemberId).map(({ id }) => id),
    ).toEqual(["shared", "family", "unassigned"]);
  });
});
