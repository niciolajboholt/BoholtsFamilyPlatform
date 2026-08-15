// Sprint 21, Del B: kurateret dansk ordbog til kategorisering af
// indkøbsliste-varer — ingen ekstern produktdatabase (se
// 21_Sprint21-planen: Open Food Facts er stregkode-/mærkevare-fokuseret og
// dårlig til fritekst som "mælk"/"æg"). En familie-specifik override (se
// shoppingLists.ts) har altid forrang over denne ordbog og gør
// kategoriseringen selvlærende over tid.

export const shoppingCategories = [
  "Frugt & grønt",
  "Mejeri",
  "Kød",
  "Bageri",
  "Frost",
  "Andet",
] as const;

export type ShoppingCategory = (typeof shoppingCategories)[number];

const fallbackCategory: ShoppingCategory = "Andet";

// Nøgleord er bevidst danske stammer/hele ord, ikke regex — matches som
// "indeholder dette som en del af varenavnet", så "letmælk" og "mælk" begge
// rammer "mælk". Sorteres efter længde (længst/mest specifik først) ved
// opslag, så "kokosmælk" ikke fejlagtigt rammer "mælk" (Mejeri) i stedet for
// sit eget, mere specifikke ord.
const categoryKeywords: Record<ShoppingCategory, string[]> = {
  "Frugt & grønt": [
    "æble",
    "banan",
    "appelsin",
    "clementin",
    "pære",
    "vindrue",
    "citron",
    "lime",
    "melon",
    "ananas",
    "jordbær",
    "hindbær",
    "blåbær",
    "solbær",
    "kartoffel",
    "kartofler",
    "gulerod",
    "gulerødder",
    "løg",
    "hvidløg",
    "tomat",
    "agurk",
    "peberfrugt",
    "salat",
    "spinat",
    "broccoli",
    "blomkål",
    "kål",
    "porre",
    "champignon",
    "svamp",
    "avocado",
    "squash",
    "aubergine",
    "selleri",
    "radise",
    "majs",
    "asparges",
    "ingefær",
    "persille",
    "basilikum",
  ],
  Mejeri: [
    "mælk",
    "letmælk",
    "sødmælk",
    "minimælk",
    "fløde",
    "yoghurt",
    "skyr",
    "ost",
    "smør",
    "æg",
    "creme fraiche",
    "kvark",
    "cottage cheese",
    "mozzarella",
    "feta",
  ],
  Kød: [
    "kylling",
    "oksekød",
    "hakket oksekød",
    "hakket kød",
    "svinekød",
    "flæsk",
    "bacon",
    "pølse",
    "pølser",
    "fars",
    "frikadelle",
    "skinke",
    "leverpostej",
    "fisk",
    "laks",
    "torsk",
    "rejer",
    "kalkun",
    "lam",
  ],
  Bageri: [
    "brød",
    "rugbrød",
    "franskbrød",
    "boller",
    "bolle",
    "croissant",
    "kage",
    "wienerbrød",
    "toast",
    "knækbrød",
    "tortilla",
  ],
  Frost: [
    "frost",
    "is",
    "fiskefilet",
    "pommes frites",
    "frosne grøntsager",
    "frostpizza",
  ],
  Andet: [],
};

const sortedKeywordEntries: { keyword: string; category: ShoppingCategory }[] = (
  Object.entries(categoryKeywords) as [ShoppingCategory, string[]][]
)
  .flatMap(([category, keywords]) => keywords.map((keyword) => ({ keyword, category })))
  .sort((a, b) => b.keyword.length - a.keyword.length);

// Samme normalisering bruges til både ordbogsopslag og til at nøgle
// familiens egne overrides — så "Mælk", "mælk " og "mælk" alle rammer samme
// række, uanset hvordan brugeren skrev varen ind.
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function guessShoppingCategory(itemName: string): ShoppingCategory {
  const normalized = normalizeItemName(itemName);

  const match = sortedKeywordEntries.find((entry) => normalized.includes(entry.keyword));

  return match?.category ?? fallbackCategory;
}

export function isShoppingCategory(value: string): value is ShoppingCategory {
  return (shoppingCategories as readonly string[]).includes(value);
}
