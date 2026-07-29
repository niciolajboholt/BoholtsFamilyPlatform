import { describe, expect, it } from "vitest";

import { slugifyMemberName } from "./useFamilyMembers";

describe("slugifyMemberName", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(slugifyMemberName("Bedstemor", [])).toBe("bedstemor");
  });

  it("transliterates Danish letters", () => {
    expect(slugifyMemberName("Ærlig Åse Østergaard", [])).toBe(
      "aerlig-aase-ostergaard",
    );
  });

  it("strips other diacritics via Unicode normalization", () => {
    expect(slugifyMemberName("José", [])).toBe("jose");
  });

  it("falls back to a generic id for a name with no usable characters", () => {
    expect(slugifyMemberName("!!!", [])).toBe("medlem");
  });

  it("adds a numeric suffix on collision", () => {
    expect(slugifyMemberName("Jens", ["jens"])).toBe("jens-2");
    expect(slugifyMemberName("Jens", ["jens", "jens-2"])).toBe("jens-3");
  });
});
