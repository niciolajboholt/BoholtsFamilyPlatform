import { describe, expect, it } from "vitest";

import { getEventOwnerColor } from "./getEventOwnerColor";
import type { CalendarOwner } from "../data/calendarOwners";

const members: CalendarOwner[] = [
  { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
  { id: "christine", name: "Christine", color: "#C06C84" },
  { id: "family", name: "Familien", color: "#6D597A" },
];

describe("getEventOwnerColor", () => {
  it("uses the single owner's color", () => {
    expect(
      getEventOwnerColor({ ownerIds: ["nicolaj"] }, members),
    ).toBe("#2E7D32");
  });

  it("uses the family color when there are multiple owners", () => {
    expect(
      getEventOwnerColor(
        { ownerIds: ["nicolaj", "christine"] },
        members,
      ),
    ).toBe("#6D597A");
  });

  it("uses the family color when the owner is 'family'", () => {
    expect(
      getEventOwnerColor({ ownerIds: ["family"] }, members),
    ).toBe("#6D597A");
  });

  it("falls back to a default color for an unknown owner", () => {
    expect(
      getEventOwnerColor({ ownerIds: ["unknown-id"] }, members),
    ).toBe("#607d8b");
  });
});
