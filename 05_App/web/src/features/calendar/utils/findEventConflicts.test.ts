import { describe, expect, it } from "vitest";

import { hasSharedOwner } from "./findEventConflicts";

describe("hasSharedOwner", () => {
  it("returns true when the exact same owner id appears in both lists", () => {
    expect(hasSharedOwner(["nicolaj"], ["nicolaj"])).toBe(true);
  });

  it("returns false when the owner lists have no id in common", () => {
    expect(hasSharedOwner(["nicolaj"], ["christine"])).toBe(false);
  });

  // Fejl fundet af Nicolaj (2026-08-20): en familie-rettet aftale
  // ("family") skal betragtes som konflikterende med ethvert specifikt
  // medlems aftale, da "family" dækker alle medlemmer — selvom "family"
  // aldrig bogstaveligt matcher fx "alfred" i en simpel id-sammenligning.
  it("treats 'family' as shared with any specific member", () => {
    expect(hasSharedOwner(["family"], ["alfred"])).toBe(true);
    expect(hasSharedOwner(["alfred"], ["family"])).toBe(true);
  });

  it("returns true when 'family' appears on both sides", () => {
    expect(hasSharedOwner(["family"], ["family"])).toBe(true);
  });
});
