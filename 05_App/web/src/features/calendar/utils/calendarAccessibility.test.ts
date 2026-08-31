import { describe, expect, it } from "vitest";

import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../models/calendarEvent";
import { getDayActionLabel, getEventActionLabel } from "./calendarAccessibility";

const members: CalendarOwner[] = [
  { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
  { id: "christine", name: "Christine", color: "#C06C84" },
  { id: "family", name: "Familien", color: "#6D597A" },
];

function buildEvent(
  title: string,
  allDay: boolean,
  ownerIds: CalendarOwnerId[],
  color?: string,
): CalendarEvent {
  return {
    id: title,
    title,
    start: "2026-08-29T09:00:00.000Z",
    end: "2026-08-29T09:30:00.000Z",
    allDay,
    ownerIds,
    source: "internal",
    sourceId: "local",
    color,
  };
}

describe("getDayActionLabel", () => {
  it("includes the formatted date", () => {
    expect(getDayActionLabel(new Date("2026-08-29"))).toBe(
      "Vælg dag og opret aftale den 29. august",
    );
  });
});

describe("getEventActionLabel", () => {
  it("omits the owner suffix when members is not passed (unchanged behavior)", () => {
    expect(
      getEventActionLabel(buildEvent("Tandlæge", false, ["nicolaj"])),
    ).not.toMatch(/Nicolaj/);
  });

  // Fase 2-opfølgning: måned-/dagsvisningen viste hidtil KUN farven som
  // ejerskabs-signal — skærmlæsere fik heller intet ejernavn at vide.
  it("includes the single owner's name when members is passed", () => {
    const label = getEventActionLabel(buildEvent("Tandlæge", false, ["nicolaj"]), members);

    expect(label).toContain("Tandlæge");
    expect(label).toContain("Nicolaj");
  });

  it("joins multiple owners' names with 'og'", () => {
    const label = getEventActionLabel(
      buildEvent("Fødselsdag", true, ["nicolaj", "christine"]),
      members,
    );

    expect(label).toBe("Rediger aftale: Fødselsdag, hele dagen, Nicolaj og Christine");
  });

  it("uses only the family name for a family-owned event", () => {
    const label = getEventActionLabel(buildEvent("Familiemiddag", true, ["family"]), members);

    expect(label).toBe("Rediger aftale: Familiemiddag, hele dagen, Familien");
  });

  it("omits the owner suffix entirely when there is no member ownership", () => {
    const label = getEventActionLabel(
      buildEvent("Delt kalender-aftale", true, [], "#5C6BC0"),
      members,
    );

    expect(label).toBe("Rediger aftale: Delt kalender-aftale, hele dagen");
  });
});
