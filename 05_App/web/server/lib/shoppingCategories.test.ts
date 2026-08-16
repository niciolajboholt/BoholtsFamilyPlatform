import { describe, expect, it } from "vitest";

import {
  guessShoppingCategory,
  isShoppingCategory,
  isShoppingListType,
  normalizeItemName,
} from "./shoppingCategories";

describe("shoppingCategories", () => {
  describe("dagligvarer", () => {
    it("guesses common Danish grocery items correctly", () => {
      expect(guessShoppingCategory("mælk", "dagligvarer")).toBe("Mejeri");
      expect(guessShoppingCategory("Æbler", "dagligvarer")).toBe("Frugt & grønt");
      expect(guessShoppingCategory("hakket oksekød", "dagligvarer")).toBe("Kød");
      expect(guessShoppingCategory("rugbrød", "dagligvarer")).toBe("Bageri");
      expect(guessShoppingCategory("is", "dagligvarer")).toBe("Frost");
    });

    it("is case- and whitespace-insensitive", () => {
      expect(guessShoppingCategory("  MÆLK  ", "dagligvarer")).toBe("Mejeri");
    });

    it("matches on a substring, so a variant like 'letmælk' still resolves", () => {
      expect(guessShoppingCategory("letmælk", "dagligvarer")).toBe("Mejeri");
      expect(guessShoppingCategory("2 stk agurk", "dagligvarer")).toBe("Frugt & grønt");
    });

    it("prefers the longer, more specific keyword when one is a substring of another", () => {
      // "is" (Frost) is a substring of both "radise" (Frugt & grønt) and
      // "fisk" (Kød) — without length-based ordering, the shorter "is"
      // keyword would incorrectly win both.
      expect(guessShoppingCategory("radise", "dagligvarer")).toBe("Frugt & grønt");
      expect(guessShoppingCategory("fisk", "dagligvarer")).toBe("Kød");
    });

    it("falls back to Andet for an unknown item", () => {
      expect(guessShoppingCategory("dopamin", "dagligvarer")).toBe("Andet");
    });

    it("validates known categories only", () => {
      expect(isShoppingCategory("Mejeri", "dagligvarer")).toBe(true);
      expect(isShoppingCategory("Ukendt", "dagligvarer")).toBe(false);
      // En byggemarked-kategori er ikke gyldig for en dagligvarer-liste.
      expect(isShoppingCategory("Værktøj", "dagligvarer")).toBe(false);
    });
  });

  describe("byggemarked", () => {
    it("guesses common Danish hardware store items correctly", () => {
      expect(guessShoppingCategory("hammer", "byggemarked")).toBe("Værktøj");
      expect(guessShoppingCategory("gipsplade", "byggemarked")).toBe("Tømmer & plader");
      expect(guessShoppingCategory("skruer", "byggemarked")).toBe("Skruer, søm & beslag");
      expect(guessShoppingCategory("maling", "byggemarked")).toBe("Maling & overflade");
      expect(guessShoppingCategory("stikkontakt", "byggemarked")).toBe("El & belysning");
      expect(guessShoppingCategory("vandrør", "byggemarked")).toBe("VVS");
      expect(guessShoppingCategory("plæneklipper", "byggemarked")).toBe("Have & udendørs");
    });

    it("prefers the longer, more specific keyword when one is a substring of another", () => {
      // "skrue" ville ellers fejlagtigt ramme "skruetrækker" (Værktøj)
      // først, hvis der ikke blev sorteret efter længde.
      expect(guessShoppingCategory("skruetrækker", "byggemarked")).toBe("Værktøj");
      expect(guessShoppingCategory("skrue", "byggemarked")).toBe("Skruer, søm & beslag");
    });

    it("falls back to Andet for an unknown item", () => {
      expect(guessShoppingCategory("dopamin", "byggemarked")).toBe("Andet");
    });

    it("does not use the dagligvarer dictionary", () => {
      // "mælk" betyder ikke noget i byggemarked-kontekst.
      expect(guessShoppingCategory("mælk", "byggemarked")).toBe("Andet");
    });

    it("validates known categories only", () => {
      expect(isShoppingCategory("Værktøj", "byggemarked")).toBe(true);
      // En dagligvarer-kategori er ikke gyldig for en byggemarked-liste.
      expect(isShoppingCategory("Mejeri", "byggemarked")).toBe(false);
    });
  });

  describe("andet", () => {
    it("always guesses the single, fixed 'Ukategoriseret' category", () => {
      expect(guessShoppingCategory("mælk", "andet")).toBe("Ukategoriseret");
      expect(guessShoppingCategory("hammer", "andet")).toBe("Ukategoriseret");
    });

    it("only validates the single fixed category", () => {
      expect(isShoppingCategory("Ukategoriseret", "andet")).toBe(true);
      expect(isShoppingCategory("Mejeri", "andet")).toBe(false);
    });
  });

  it("normalizes names consistently for override lookups", () => {
    expect(normalizeItemName("  Mælk ")).toBe("mælk");
  });

  it("validates known list types only", () => {
    expect(isShoppingListType("dagligvarer")).toBe(true);
    expect(isShoppingListType("byggemarked")).toBe(true);
    expect(isShoppingListType("andet")).toBe(true);
    expect(isShoppingListType("ukendt")).toBe(false);
  });
});
