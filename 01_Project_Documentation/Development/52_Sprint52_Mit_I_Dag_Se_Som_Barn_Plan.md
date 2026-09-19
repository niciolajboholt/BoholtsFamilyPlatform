# 52_Sprint52_Mit_I_Dag_Se_Som_Barn_Plan

Version: 1.0

Project:
Boholts Family Platform (Hjemmecentralen)

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Implementeret 2026-09-19. Første konkrete skridt af
`51_Barnets_Hjemmecentral_Plan.md`s fase 2 ("Mit i dag") og fase 3's
anbefalede rækkefølge ("Se som barn" bygges før et rigtigt barne-login) —
se "Beslutninger" nedenfor for hvordan Nicolaj skar omfanget til.

---

## Formål

En ny "Mit i dag"-side: et overskueligt dagsoverblik pr. familiemedlem
(næste aktivitet, resten af dagens aftaler/opgaver), genbrugt direkte oven
på eksisterende kalender-/opgavedata — INGEN ny datamodel, INGEN ny
sikkerhed endnu. Formålet med denne sprint er udelukkende selve visningen
og interaktionen (skifte medlem, afkrydse egne opgaver), tilgængelig for
enhver allerede logget ind bruger, som en "se som barn"-forhåndsvisning
for en forælder.

---

## Beslutninger (samtale med Nicolaj, 2026-09-19)

Inden implementering blev to mockups (variant A: siden følger appens
eksisterende "aktuelt medlem"; variant B: siden har sin egen
medlems-pillevælger) lavet og vist frem. Nicolajs svar:

1. **Design: variant B.** "Mit i dag" har sin EGEN pillevælger øverst på
   siden — uafhængig af "Min profil" i Indstillinger (`useCurrentMember`).
   At vælge et medlem her ændrer IKKE enhedens "aktuelt medlem".
2. **Rækkefølge: "Se som barn" først, PIN-kode-adgang i en senere,
   selvstændig sprint.** Denne sprint bygger kun selve siden — ingen ny
   sikkerhedsmodel. Siden er lige så tilgængelig som resten af appen for
   enhver, der allerede er logget ind.
3. **Fremtidig lås-metode (til den senere PIN-sprint, IKKE bygget her):**
   4-cifret talkode, med sin egen kode PR BARN (ikke én fælles
   familiekode). Noteret her, så den senere sprint-plan kan starte fra
   denne beslutning i stedet for at spørge igen.
4. **Skriveadgang: kan afkrydse egne opgaver.** Matcher mockuppens
   Checkbox-interaktion — intet andet kan ændres fra denne side (ingen
   sletning, ingen redigering af kalenderaftaler eller andre medlemmer).

---

## Omfang for denne sprint

- Ny side, `/mit-i-dag`, i hovednavigationen (sidebar + bundnavigation),
  bag en ny valgfri feature-flag `mit-i-dag` — samme "kan slås til/fra
  pr. familie under Flere funktioner"-mønster som øvrige nyere,
  valgfrie funktioner (Sprint 43's begrundelse, `0027_feature_flags.sql`).
- Pillevælger øverst med alle RIGTIGE familiemedlemmer (server-rækker med
  `relation !== null` — `relation === null` er reserveret til
  familie-pseudomedlemmet, se `familyMembersSync.ts`s kommentar). Ingen
  skelnen mellem barn/voksen i selve valget: `relation` er et frit,
  valgfrit tekstfelt uden en pålidelig "er dette et barn"-garanti, så
  ALLE medlemmer vises i vælgeren, ligesom andre medlemslister i appen.
- **"Næste"-kort**: den først kommende, endnu ikke overståede
  kalenderaftale for den valgte profil i dag (`getPlannerEventsForColumn`
  + `getEventsForDate`, samme grundmønster som `KioskPage.tsx`); findes
  ingen, falder den tilbage til den første ufærdige opgave tildelt
  profilen; findes intet af delene, en tom-tilstand ("Ingen flere
  aktiviteter i dag").
- **"Resten af dagen"**: øvrige kalenderaftaler i dag (skrivebeskyttet,
  kalender-ikon) efterfulgt af medlemmets opgaver i dag (afkrydsbare,
  samme `Checkbox`+gennemstreget-mønster som `TasksPage.tsx`, kaldet via
  den eksisterende `useTasks().toggleDone` — ingen ny API-rute).
- **"Beskeder fra forældre"**: uændret, statisk placeholder-tekst — selve
  beskedfunktionens omfang (kun tekst? emoji? læst-kvittering?) er
  stadig ikke besluttet, jf. `51_Barnets_Hjemmecentral_Plan.md`.
- Design matcher Hjemmecentralens eget Material UI-tema
  (`src/theme/theme.ts`) — ingen kopiering af Pointo eller lignende
  produkters design/tekst/kode, jf. Sprint 51-planens eksplicitte
  afgrænsning.

## Eksplicit ikke i denne sprint

- **PIN-baseret børneadgang** — egen, selvstændig sprint (beslutning 2+3
  ovenfor er kun noteret til brug der, intet er bygget).
- Beskeder fra forældre (reelt indhold/omfang).
- Oplæsning (Web Speech API).
- Point-/mållag oven på lommepenge, faste rutine-skabeloner, guidede
  eksterne kalenderforbindelser (Aula/DBU Kampklar/Holdsport).
- Enhver ændring af `useCurrentMember`/"Min profil"-mekanismen.

---

## Teststrategi

- Ingen sider i `src/pages/` har i dag en `.test.tsx`-modstykke (kun
  TypeScript + ESLint + Playwright-e2e-smoke dækker dem) — "Mit i dag"
  følger samme, eksisterende konvention, ingen ny testkonvention indført.
- `npx tsc -b --force` og `npm run lint` skal være rene (samme bar som
  alle tidligere sprints).
- Manuel verifikation anbefalet: slå "Mit i dag" til under Indstillinger
  → Flere funktioner, åbn siden, skift mellem mindst to medlemmer, afkryds
  en opgave og genindlæs siden for at bekræfte den forbliver afkrydset
  (går gennem samme `PATCH`-rute som Opgaver-siden, ingen ny server-kode).
