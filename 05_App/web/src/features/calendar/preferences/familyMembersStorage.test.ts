// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { calendarOwners } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import {
  getFamilyMemberIds,
  getFamilyMembers,
  hasCompletedFamilySetup,
  saveFamilyMembers,
} from "./familyMembersStorage";

describe("familyMembersStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to the seed data when nothing is stored", () => {
    const members = getFamilyMembers();

    expect(members).toEqual(Object.values(calendarOwners));
  });

  it("falls back to the seed data when storage holds invalid JSON", () => {
    window.localStorage.setItem(
      "boholts-family-members",
      "not valid json {{{",
    );

    expect(getFamilyMembers()).toEqual(Object.values(calendarOwners));
  });

  it("falls back to the seed data when a stored member is missing required fields", () => {
    window.localStorage.setItem(
      "boholts-family-members",
      JSON.stringify([{ id: "x", name: "" }]),
    );

    expect(getFamilyMembers()).toEqual(Object.values(calendarOwners));
  });

  it("returns exactly what was saved when it round-trips correctly", () => {
    const members = [
      { id: "nicolaj", name: "Nicolaj", color: "#2E7D32", relation: "Far" as const },
      { id: "family", name: "Familien", color: "#6D597A" },
    ];

    saveFamilyMembers(members);

    expect(getFamilyMembers()).toEqual(members);
  });

  it("adds back the family pseudo-member if it's missing from storage", () => {
    saveFamilyMembers([
      { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
    ]);

    const members = getFamilyMembers();

    expect(members.some((member) => member.id === familyPseudoMemberId)).toBe(
      true,
    );
  });

  it("getFamilyMemberIds returns just the ids", () => {
    saveFamilyMembers([
      { id: "nicolaj", name: "Nicolaj", color: "#2E7D32" },
      { id: "family", name: "Familien", color: "#6D597A" },
    ]);

    expect(getFamilyMemberIds()).toEqual(["nicolaj", "family"]);
  });

  it("accepts a stored member with isPlaceholderName set", () => {
    const members = [
      {
        id: "far",
        name: "Far",
        color: "#2E7D32",
        isPlaceholderName: true,
      },
      { id: "family", name: "Familien", color: "#6D597A" },
    ];

    saveFamilyMembers(members);

    expect(getFamilyMembers()).toEqual(members);
  });

  it("falls back to the seed data when isPlaceholderName is not a boolean", () => {
    window.localStorage.setItem(
      "boholts-family-members",
      JSON.stringify([
        { id: "x", name: "X", color: "#000", isPlaceholderName: "yes" },
      ]),
    );

    expect(getFamilyMembers()).toEqual(Object.values(calendarOwners));
  });

  describe("hasCompletedFamilySetup", () => {
    it("is false when nothing has ever been saved", () => {
      expect(hasCompletedFamilySetup()).toBe(false);
    });

    it("is true once family members have been saved, even via the generic seed", () => {
      saveFamilyMembers(Object.values(calendarOwners));

      expect(hasCompletedFamilySetup()).toBe(true);
    });
  });
});
