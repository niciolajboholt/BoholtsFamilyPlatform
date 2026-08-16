# 22_Sprint22_Flere_Indkoebslister_Plan

> Status: Afventer godkendelse

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-16

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Udvid indkøbslisten (Sprint 21, Del B) fra "én implicit liste pr. familie"
til **flere navngivne lister**, hver med en **type** valgt ved oprettelse.
Typen bestemmer hvilket kategorisæt og hvilken nøgleords-ordbog listen
bruger — en byggemarked-liste skal ikke forsøge at kategorisere "skruer"
som "Frugt & grønt".

Sprint 21's datamodel var allerede bygget til flere lister
(`shopping_lists` er list-scoped fra dag ét), men *ikke* til at lister kan
have forskellig kategorisering — det kræver en ny migration og en
omstrukturering af `shoppingCategories.ts`.

---

## Beslutninger (godkendt i chat, 2026-08-16)

1. **Listetyper er et fast, foruddefineret sæt i kode** — ikke
   brugerdefinerbare. At tilføje en ny type senere er en kodeændring
   (ny ordbog + migration for kategorisæt), ikke en UI-handling.
2. **To typer til at starte med**: `dagligvarer` (det eksisterende
   kategorisæt fra Sprint 21) og `byggemarked` (nyt, se nedenfor). En
   tredje, ukategoriseret fallback-type `andet` tilføjes billigt: ingen
   gruppering, bare en flad liste — til alt, der ikke passer i de to
   andre.
3. **Selvlæringen (`shopping_item_category_overrides`) skal være
   pr. type**, ikke kun pr. familie — samme varenavn kan betyde noget
   forskelligt i forskellig kontekst (fx "maling" i dagligvarer vs.
   byggemarked er usandsynligt, men "olie" er et reelt eksempel).

---

## Datamodel (migration 0007)

```sql
ALTER TABLE shopping_lists ADD COLUMN type TEXT NOT NULL DEFAULT 'dagligvarer';

-- SQLite kan ikke ændre en PRIMARY KEY in-place — tabellen genskabes med
-- list_type tilføjet til nøglen, og eksisterende rækker (alle fra Sprint
-- 21, hvor der kun fandtes dagligvarer-lister) migreres som 'dagligvarer'.
CREATE TABLE shopping_item_category_overrides_new (
  family_id TEXT NOT NULL REFERENCES families(id),
  list_type TEXT NOT NULL,
  item_name_normalized TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (family_id, list_type, item_name_normalized)
);

INSERT INTO shopping_item_category_overrides_new
  (family_id, list_type, item_name_normalized, category)
SELECT family_id, 'dagligvarer', item_name_normalized, category
FROM shopping_item_category_overrides;

DROP TABLE shopping_item_category_overrides;
ALTER TABLE shopping_item_category_overrides_new RENAME TO shopping_item_category_overrides;
```

Alle familiens **eksisterende** indkøbslister (auto-oprettet i Sprint 21)
får `type = 'dagligvarer'` via `DEFAULT` — korrekt bagudkompatibelt, ingen
data går tabt.

---

## Kategorisæt

**Dagligvarer** (uændret fra Sprint 21): Frugt & grønt, Mejeri, Kød,
Bageri, Frost, Andet.

**Byggemarked** (nyt — forslag, ret til hvis noget mangler eller er
forkert grupperet):

- Værktøj
- Tømmer & plader
- Skruer, søm & beslag
- Maling & overflade
- El & belysning
- VVS
- Have & udendørs
- Andet

Ordbogen for byggemarked bygges efter samme mønster som dagligvarer
(`categoryKeywords` i `shoppingCategories.ts`) — et opstartssæt af danske
byggemarkeds-ord (skrue, søm, hammer, boremaskine, maling, pensel, fliser,
osv.), suppleret af selvlæring fra brug.

**Andet**: ingen kategorisering. Alt havner i én flad liste uden
gruppe-overskrifter — for indkøb, der ikke passer ind i de to andre typer.

---

## Server-ændringer

- **`server/lib/shoppingCategories.ts`**: refaktoreres til at være
  type-bevidst — separate kategorisæt og nøgleords-ordbøger pr. type,
  bag funktioner som tager `type` som parameter (`guessShoppingCategory(name, type)`,
  `isShoppingCategory(category, type)`). `andet`-typen har et tomt
  kategorisæt og gætter altid `null`/ingen kategori.
- **`server/routes/shoppingLists.ts`**:
  - `POST /:id/shopping-lists` kræver nu `type` (én af de tre faste
    værdier) i stedet for kun `name`.
  - List-DTO'en returnerer `type`.
  - `resolveCategory`/`saveOverride` slår op og gemmer pr.
    `(familyId, list.type, itemName)` i stedet for kun `(familyId, itemName)`.
  - Kategori-validering ved tilføj/redigér vare sker mod listens type.
- Migrationen og kodeændringen deployes sammen — samme rækkefølge-lektion
  som resten af sprintet: migrationen skal køres manuelt på beta og
  produktion, før koden, der forudsætter `type`-kolonnen, går i luften.

## Klient-ændringer

- **Liste-vælger**: `useShoppingList`-hooket henter i dag kun familiens
  *første* liste. Udvides til at hente alle lister og lade brugeren skifte
  mellem dem (fx faner eller en dropdown i toppen af `ShoppingListPage`).
- **"Opret ny liste"-flow**: navn + type-vælger (Dagligvarer / Byggemarked
  / Andet) — en simpel dialog/formular.
- Selve vare-listen og kategoriseringen i `ShoppingListPage` kræver ingen
  ændring — kategorien kommer allerede som en streng fra serveren og bruges
  kun til visning; typen styrer blot *hvilke* strenge serveren returnerer.

---

## Rækkefølge

1. Migration 0007 (kør manuelt på beta og produktion, samme mønster som
   0004-0006).
2. Server: type-bevidst `shoppingCategories.ts`, opdaterede ruter.
3. Klient: liste-vælger + "opret ny liste"-dialog med typevalg.
4. Manuel test: opret en byggemarked-liste, tilføj et par varer, bekræft
   fornuftig kategorisering og at push-notifikationer stadig virker
   uændret.

---

## Kendte risici

1. **Byggemarked-ordbogen vil have dårligere dækning end dagligvarer ved
   lancering** — samme, accepterede start-tilstand som dagligvarer havde i
   Sprint 21 (mere lander i "Andet", indtil ordbogen lærer af brug).
2. **Migrationen af `shopping_item_category_overrides`** genskaber
   tabellen (SQLite/D1 kan ikke ændre en PRIMARY KEY in-place) — lavt
   risiko, da tabellen i dag kun indeholder familiens egne, få rettede
   kategorier, men bekræftes efter kørsel med et `SELECT COUNT(*)` før/efter.

---

## Godkendelse

Intet kodearbejde påbegyndes, før Nicolaj har godkendt denne plan —
herunder specifikt byggemarked-kategorierne ovenfor, som er et forslag.
Godkend ved at sige til i chatten.
