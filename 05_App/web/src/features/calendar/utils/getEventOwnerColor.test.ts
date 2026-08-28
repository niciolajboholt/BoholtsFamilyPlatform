import { describe, expect, it } from "vitest";

import {
  getCalendarSourceDisplayColors,
  getEventOwnerBorderSx,
  getEventOwnerColor,
  getEventOwnerColors,
  neutralFallbackColor,
} from "./getEventOwnerColor";
import type { CalendarOwner } from "../data/calendarOwners";

const members: CalendarOwner[] = [
  { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
  { id: "christine", name: "Christine", color: "#C06C84" },
  { id: "jens", name: "Jens", color: "#00838F" },
  { id: "family", name: "Familien", color: "#6D597A" },
];

describe("getEventOwnerColors", () => {
  it("uses the single member's own color", () => {
    expect(getEventOwnerColors({ ownerIds: ["nicolaj"] }, members)).toEqual(["#2E7D32"]);
  });

  // Kernen i denne rettelse: flere matchede medlemmer må IKKE give
  // Familien-farven — de skal vises med deres egne farver, i samme
  // rækkefølge som ownerIds.
  it("uses each matched member's own color for multiple owners, not the family color", () => {
    expect(getEventOwnerColors({ ownerIds: ["christine", "jens"] }, members)).toEqual([
      "#C06C84",
      "#00838F",
    ]);
  });

  it("uses the family color for a real family/shared event (explicit family-tilknytning)", () => {
    expect(getEventOwnerColors({ ownerIds: ["family"] }, members)).toEqual(["#6D597A"]);
  });

  it("uses the family color even if 'family' is mixed with other owner ids", () => {
    expect(getEventOwnerColors({ ownerIds: ["family", "nicolaj"] }, members)).toEqual(["#6D597A"]);
  });

  it("falls back to the event's own source color when there is no member ownership at all", () => {
    // Fx et ICS-abonnement uden medlemstilknytning (se icsCalendarMapper.ts)
    // — abonnementets egen valgte farve, ikke Familien-farven.
    expect(getEventOwnerColors({ ownerIds: [], color: "#5C6BC0" }, members)).toEqual(["#5C6BC0"]);
  });

  it("falls back to the neutral default when there is neither ownership nor a source color", () => {
    expect(getEventOwnerColors({ ownerIds: [] }, members)).toEqual([neutralFallbackColor]);
  });

  it("falls back to the event's own source color when the single owner id is unknown", () => {
    expect(getEventOwnerColors({ ownerIds: ["unknown-id"], color: "#5C6BC0" }, members)).toEqual([
      "#5C6BC0",
    ]);
  });

  it("falls back to the neutral default when the single owner id is unknown and there is no source color", () => {
    expect(getEventOwnerColors({ ownerIds: ["unknown-id"] }, members)).toEqual([neutralFallbackColor]);
  });

  it("skips an unresolvable owner id among otherwise-matched multiple owners", () => {
    expect(getEventOwnerColors({ ownerIds: ["christine", "unknown-id"] }, members)).toEqual([
      "#C06C84",
    ]);
  });
});

describe("getEventOwnerColor", () => {
  it("returns the first/primary color from getEventOwnerColors", () => {
    expect(getEventOwnerColor({ ownerIds: ["christine", "jens"] }, members)).toBe("#C06C84");
  });
});

describe("getCalendarSourceDisplayColors", () => {
  it("uses the same current member color as the source's events", () => {
    expect(
      getCalendarSourceDisplayColors(
        "google:work",
        "#D32F2F",
        [{ sourceId: "google:work", ownerIds: ["jens"] }],
        members,
      ),
    ).toEqual(["#00838F"]);
  });

  it("shows every distinct member color represented by a source", () => {
    expect(
      getCalendarSourceDisplayColors(
        "google:work",
        "#D32F2F",
        [
          { sourceId: "google:work", ownerIds: ["jens"] },
          { sourceId: "google:work", ownerIds: ["christine", "jens"] },
        ],
        members,
      ),
    ).toEqual(["#00838F", "#C06C84"]);
  });

  it("keeps the source color when no loaded event can resolve a member color", () => {
    expect(getCalendarSourceDisplayColors("ics:work", "#D32F2F", [], members)).toEqual([
      "#D32F2F",
    ]);
  });
});

describe("getEventOwnerBorderSx", () => {
  it("returns a full-strength inset accent for a single color", () => {
    const sx = getEventOwnerBorderSx(["#2E7D32"], 4);

    expect(sx.borderLeft).toBe("none");
    expect(sx["&::before"]).toMatchObject({
      left: 0,
      top: 0,
      bottom: 0,
      width: "4px",
      background: "#2E7D32",
    });
  });

  it("returns a hard-stop split accent for multiple colors, in order", () => {
    const sx = getEventOwnerBorderSx(["#C06C84", "#00838F"], 4);

    expect(sx["&::before"].background).toBe(
      "linear-gradient(to bottom, #C06C84 0%, #C06C84 50%, #00838F 50%, #00838F 100%)",
    );
  });

  it("divides three colors into three equal, hard-stop bands", () => {
    const sx = getEventOwnerBorderSx(["#111111", "#222222", "#333333"], 3);

    expect(sx["&::before"].background).toBe(
      "linear-gradient(to bottom, " +
        "#111111 0%, #111111 33.33333333333333%, " +
        "#222222 33.33333333333333%, #222222 66.66666666666666%, " +
        "#333333 66.66666666666666%, #333333 100%)",
    );
  });
});
