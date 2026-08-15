import { describe, expect, it } from "vitest";

import { guessShoppingCategory, isShoppingCategory, normalizeItemName } from "./shoppingCategories";

describe("shoppingCategories", () => {
  it("guesses common Danish grocery items correctly", () => {
    expect(guessShoppingCategory("mælk")).toBe("Mejeri");
    expect(guessShoppingCategory("Æbler")).toBe("Frugt & grønt");
    expect(guessShoppingCategory("hakket oksekød")).toBe("Kød");
    expect(guessShoppingCategory("rugbrød")).toBe("Bageri");
    expect(guessShoppingCategory("is")).toBe("Frost");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(guessShoppingCategory("  MÆLK  ")).toBe("Mejeri");
  });

  it("matches on a substring, so a variant like 'letmælk' still resolves", () => {
    expect(guessShoppingCategory("letmælk")).toBe("Mejeri");
    expect(guessShoppingCategory("2 stk agurk")).toBe("Frugt & grønt");
  });

  it("prefers the longer, more specific keyword when one is a substring of another", () => {
    // "is" (Frost) is a substring of both "radise" (Frugt & grønt) and
    // "fisk" (Kød) — without length-based ordering, the shorter "is"
    // keyword would incorrectly win both.
    expect(guessShoppingCategory("radise")).toBe("Frugt & grønt");
    expect(guessShoppingCategory("fisk")).toBe("Kød");
  });

  it("falls back to Andet for an unknown item", () => {
    expect(guessShoppingCategory("dopamin")).toBe("Andet");
  });

  it("normalizes names consistently for override lookups", () => {
    expect(normalizeItemName("  Mælk ")).toBe("mælk");
  });

  it("validates known categories only", () => {
    expect(isShoppingCategory("Mejeri")).toBe(true);
    expect(isShoppingCategory("Ukendt")).toBe(false);
  });
});
