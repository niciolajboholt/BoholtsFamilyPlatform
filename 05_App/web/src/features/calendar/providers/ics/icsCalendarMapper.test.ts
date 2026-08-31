import { describe, expect, it } from "vitest";

import { mapIcsCalendarEvent, mapIcsCalendarSource } from "./icsCalendarMapper";
import type { IcsCalendarEventDto, IcsCalendarSubscriptionDto } from "../../../family/familyApi";

const subscription: IcsCalendarSubscriptionDto = {
  id: "sub-1",
  familyId: "family-1",
  url: "https://example.com/kalender.ics",
  label: "Skolekalender",
  familyMemberId: null,
  color: "#5C6BC0",
  lastFetchedAt: null,
  lastFetchStatus: null,
  createdAt: "2026-08-28T00:00:00.000Z",
};

const event: IcsCalendarEventDto = {
  id: "evt-1",
  title: "Forældremøde",
  start: "2026-08-28T18:00:00+02:00",
  end: "2026-08-28T19:00:00+02:00",
  allDay: false,
  isPrivate: false,
};

describe("mapIcsCalendarEvent", () => {
  // Fase 1-følgeret: abonnementets egen valgte farve skal følge med den
  // enkelte AFTALE (event.color), ikke kun kilden (mapIcsCalendarSource) —
  // ellers falder getEventOwnerColor() tilbage til Familien-farven for et
  // ikke-tildelt abonnement, uanset hvilken farve familien selv har valgt.
  it("carries the subscription's own color on the event when there is no assigned member", () => {
    const mapped = mapIcsCalendarEvent("sub-1", event, undefined, subscription.color);

    expect(mapped.ownerIds).toEqual([]);
    expect(mapped.color).toBe("#5C6BC0");
  });

  it("sets ownerIds to the assigned member, still carrying the subscription color as a fallback", () => {
    const mapped = mapIcsCalendarEvent("sub-1", event, "member-christine", subscription.color);

    expect(mapped.ownerIds).toEqual(["member-christine"]);
    // Uskadeligt at sætte den her — getEventOwnerColor() bruger den kun,
    // når ownerIds er tom (medlemmets farve vinder altid, når der ER et
    // ownerId).
    expect(mapped.color).toBe("#5C6BC0");
  });

  it("leaves the event's color undefined when the subscription has no color chosen", () => {
    const mapped = mapIcsCalendarEvent("sub-1", event, undefined, null);

    expect(mapped.color).toBeUndefined();
  });
});

describe("mapIcsCalendarSource", () => {
  it("uses the assigned member's color over the subscription's own color", () => {
    const source = mapIcsCalendarSource(subscription, {
      id: "member-christine",
      name: "Christine",
      color: "#C06C84",
    });

    expect(source.color).toBe("#C06C84");
  });

  it("uses the subscription's own color when there is no assigned member", () => {
    const source = mapIcsCalendarSource(subscription);

    expect(source.color).toBe("#5C6BC0");
  });

  it("falls back to a generic color, distinct from the subscription's chosen color, when none is set", () => {
    const withColor = mapIcsCalendarSource({ ...subscription, color: "#FF0000" });
    const withoutColor = mapIcsCalendarSource({ ...subscription, color: null });

    expect(withColor.color).toBe("#FF0000");
    expect(withoutColor.color).not.toBe("#FF0000");
    expect(withoutColor.color).not.toBeNull();
  });
});
