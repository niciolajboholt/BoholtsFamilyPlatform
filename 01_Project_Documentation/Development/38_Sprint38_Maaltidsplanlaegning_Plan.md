# 38_Sprint38_Maaltidsplanlaegning_Plan

> Status: Forslag — afventer godkendelse af scope/rækkefølge

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-09

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

En ugeplan (mandag–søndag → ret pr. dag), der kan generere
indkøbsliste-varer automatisk ud fra retterne — første af de seks nye
funktioner fra udbygningsplanens Del B, valgt først fordi den bygger
direkte videre på infrastruktur, der allerede findes og er verificeret i
brug: indkøbslisten (Sprint 21-22) og AI-modulet (Sprint 23).

---

## Verificeret genanvendeligt grundlag

- `server/lib/aiAssistant.ts`s `generateIngredientsDraft(env, dish)` findes
  allerede og bruges i dag fra `SuggestIngredientsDialog.tsx` til at
  foreslå ingredienser til indkøbslisten ud fra ÉN rets navn — samme
  Workers AI-model (`@cf/zai-org/glm-4.7-flash`), samme "udkast, aldrig
  automatisk gemt"-princip. Måltidsplanen kan kalde denne funktion én gang
  pr. ret i ugeplanen, ikke en ny AI-prompt-type.
- Indkøbslisten understøtter allerede flere navngivne lister med type
  (`shoppingListTypes`) — en genereret vareliste fra ugeplanen lægges ind
  som almindelige varer på en valgt eksisterende liste (typisk
  "dagligvarer"), ikke en ny listetype.
- Ingen `meal_plans`- eller lignende tabel findes i dag
  (`server/migrations/`) — dette er reelt ny data, ikke en udvidelse af
  noget eksisterende.

---

## Foreslåede beslutninger

1. **Ny tabel `meal_plan_entries`** (familie-scoped, samme mønster som
   `tasks`/`shopping_list_items`): `id`, `family_id`, `date` (ISO-dato,
   ikke ugedag — undgår tvetydighed ved uge-skift), `dish_name`,
   `created_by_user_id`, `created_at`. Ingen kobling til et specifikt
   familiemedlem i v1 — måltider er familie-fælles, ikke personlige,
   samme antagelse som selve indkøbslisten.
2. **Generér ingredienser pr. ret, ikke pr. uge.** Ét
   `generateIngredientsDraft`-kald pr. udfyldt dag i ugeplanen, resultaterne
   samles og de-duplikeres (samme varenavn på tværs af flere retter) FØR de
   vises til brugeren som ét samlet udkast — ligesom den eksisterende
   dialog, blot med flere retter som input i stedet for én.
3. **Brugeren vælger selv, hvilke foreslåede varer der rent faktisk
   tilføjes** (samme mønster som `SuggestIngredientsDialog`) — ingen
   automatisk indkøbsliste-opdatering uden et aktivt tilvalg, i tråd med
   Sprint 23's beslutning 4 om, at AI-udkast aldrig gemmes automatisk.
4. **Egen side/faneblad, ikke en udvidelse af `ShoppingListPage`.** En
   ugeplan er konceptuelt forskellig fra en indkøbsliste (dage vs. varer) —
   ny rute `/meal-plan` i `AppRouter.tsx`, egen `MealPlanPage.tsx`, egen
   `features/mealPlan/`-mappe (samme struktur som `features/shoppingList/`
   og `features/tasks/`).

---

## Kendte risici og åbne spørgsmål

- **Ugestart:** Skal ugen vises mandag-søndag (dansk konvention, som resten
  af appen bruger for kalenderen) — antaget ja, men bør bekræftes med
  Nicolaj før implementering.
- **Gentagelse:** Skal en ret kunne markeres som "denne uges faste ret"
  (fx "tacofredag") og automatisk foreslås igen? Ikke en del af v1 — ren
  ugentlig indtastning i første omgang, foreslås som en mulig
  Sprint 38-opfølgning, ikke bygget forudseende nu.
- **Ingen mængdeangivelse.** Ligesom den eksisterende
  `SuggestIngredientsDialog` foreslår AI-modulet kun varenavne, ikke
  mængder (fx "hakket oksekød", ikke "500 g") — samme bevidste
  forenkling videreføres, ikke noget nyt at løse her.

---

## Kvalitetsgate

Som de øvrige sprints: `npm run lint`, `npm run build`, `npm test`,
`npm run test:e2e` grønne før merge. Ny migration verificeres manuelt med
`SELECT ... FROM sqlite_master` på beta, jf.
[09_Lessons_Learned](../AI_Knowledge_Base/09_Lessons_Learned.md).
