// Sprint 21, Del B (udvidet i Sprint 22): kuraterede danske ordbøger til
// kategorisering af indkøbsliste-varer — ingen ekstern produktdatabase (se
// 21_Sprint21-planen: Open Food Facts er stregkode-/mærkevare-fokuseret og
// dårlig til fritekst som "mælk"/"æg"). En familie- og listetype-specifik
// override (se shoppingLists.ts) har altid forrang over disse ordbøger og
// gør kategoriseringen selvlærende over tid.
//
// Sprint 22 tilføjede listetyper: hver liste har en fast type
// (dagligvarer/byggemarked/andet), og typen bestemmer hvilket kategorisæt
// og hvilken ordbog varerne slås op i — en byggemarked-liste skal ikke
// forsøge at kategorisere "skruer" som "Frugt & grønt".

export const shoppingListTypes = ["dagligvarer", "byggemarked", "andet"] as const;

export type ShoppingListType = (typeof shoppingListTypes)[number];

export function isShoppingListType(value: string): value is ShoppingListType {
  return (shoppingListTypes as readonly string[]).includes(value);
}

// "andet"-typen er bevidst ukategoriseret (se Sprint 22-planen) — alle
// varer får denne ene, faste kategori, og klienten viser listen fladt uden
// gruppe-overskrifter.
const uncategorized = "Ukategoriseret";

const dagligvarerCategories = [
  "Frugt & grønt",
  "Mejeri",
  "Kød",
  "Bageri",
  "Frost",
  "Andet",
] as const;

// Nøgleord er bevidst danske stammer/hele ord, ikke regex — matches som
// "indeholder dette som en del af varenavnet", så "letmælk" og "mælk" begge
// rammer "mælk". Sorteres efter længde (længst/mest specifik først) ved
// opslag, så "kokosmælk" ikke fejlagtigt rammer "mælk" (Mejeri) i stedet for
// sit eget, mere specifikke ord.
const dagligvarerKeywords: Record<(typeof dagligvarerCategories)[number], string[]> = {
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

const byggemarkedCategories = [
  "Værktøj",
  "Tømmer & plader",
  "Skruer, søm & beslag",
  "Maling & overflade",
  "El & belysning",
  "VVS",
  "Have & udendørs",
  "Andet",
] as const;

const byggemarkedKeywords: Record<(typeof byggemarkedCategories)[number], string[]> = {
  Værktøj: [
    "hammer",
    "skruetrækker",
    "boremaskine",
    "rundsav",
    "stiksav",
    "håndsav",
    "tommestok",
    "målebånd",
    "vaterpas",
    "skruenøgle",
    "topnøgle",
    "hobbykniv",
    "vinkelsliber",
    "høvl",
    "bidetang",
    "skruetvinge",
    "sav",
    "tang",
    "kniv",
  ],
  "Tømmer & plader": [
    "krydsfiner",
    "spånplade",
    "gipsplade",
    "brædt",
    "planke",
    "gips",
    "osb",
    "lægte",
    "liste",
  ],
  "Skruer, søm & beslag": [
    "rawlplug",
    "hængsler",
    "hængsel",
    "møtrik",
    "beslag",
    "skruer",
    "skrue",
    "søm",
    "spiger",
    "bolt",
    "plugs",
    "lås",
    "låge",
    "dyvel",
  ],
  "Maling & overflade": [
    "spartelmasse",
    "malerrulle",
    "fugemasse",
    "silikone",
    "sandpapir",
    "maling",
    "spartel",
    "pensel",
    "ruller",
    "lak",
    "tapet",
    "grunder",
  ],
  "El & belysning": [
    "forlængerledning",
    "stikkontakt",
    "sikring",
    "ledning",
    "kontakt",
    "kabel",
    "pære",
    "lyskilde",
  ],
  VVS: [
    "blandingsbatteri",
    "vandrør",
    "cisterne",
    "afløb",
    "vandlås",
    "fitting",
    "ventil",
    "pakning",
    "rør",
    "wc",
  ],
  "Have & udendørs": [
    "plæneklipper",
    "havehandsker",
    "plantekasse",
    "terrassebrædt",
    "hæksaks",
    "gødning",
    "fliser",
    "plante",
    "muld",
    "jord",
  ],
  Andet: [],
};

interface CategorySet {
  categories: readonly string[];
  fallback: string;
  keywords: Record<string, string[]>;
}

const categorySets: Record<ShoppingListType, CategorySet> = {
  dagligvarer: { categories: dagligvarerCategories, fallback: "Andet", keywords: dagligvarerKeywords },
  byggemarked: { categories: byggemarkedCategories, fallback: "Andet", keywords: byggemarkedKeywords },
  andet: { categories: [uncategorized], fallback: uncategorized, keywords: {} },
};

interface KeywordEntry {
  keyword: string;
  category: string;
}

function buildSortedKeywordEntries(keywords: Record<string, string[]>): KeywordEntry[] {
  return Object.entries(keywords)
    .flatMap(([category, entries]) => entries.map((keyword) => ({ keyword, category })))
    .sort((a, b) => b.keyword.length - a.keyword.length);
}

const sortedKeywordEntriesByType: Record<ShoppingListType, KeywordEntry[]> = {
  dagligvarer: buildSortedKeywordEntries(dagligvarerKeywords),
  byggemarked: buildSortedKeywordEntries(byggemarkedKeywords),
  andet: [],
};

// Samme normalisering bruges til både ordbogsopslag og til at nøgle
// familiens egne overrides — så "Mælk", "mælk " og "mælk" alle rammer samme
// række, uanset hvordan brugeren skrev varen ind.
export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function guessShoppingCategory(itemName: string, type: ShoppingListType): string {
  const normalized = normalizeItemName(itemName);
  const match = sortedKeywordEntriesByType[type].find((entry) => normalized.includes(entry.keyword));

  return match?.category ?? categorySets[type].fallback;
}

export function isShoppingCategory(value: string, type: ShoppingListType): boolean {
  return categorySets[type].categories.includes(value);
}
