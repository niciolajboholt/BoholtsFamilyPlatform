import { describe, expect, it } from "vitest";

import { isChildRelation } from "./familyMemberRelations";

describe("isChildRelation", () => {
  it("is true only for 'Barn'", () => {
    expect(isChildRelation("Barn")).toBe(true);
  });

  it("is false for adult relations, 'Andet', and the family pseudo-profile (null)", () => {
    expect(isChildRelation("Far")).toBe(false);
    expect(isChildRelation("Mor")).toBe(false);
    expect(isChildRelation("Andet")).toBe(false);
    expect(isChildRelation(null)).toBe(false);
  });
});
