# 54_Sprint54_Rutineskabeloner_Plan

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
Implementeret 2026-09-19. Fase 4 af `51_Barnets_Hjemmecentral_Plan.md`
("faste rutineskabeloner").

---

## Formål

Gøre det hurtigere at oprette de mest almindelige børnerutiner
(morgenrutine, skoletaske, tandbørstning, sengetid) uden at skulle skrive
navn og alle opgaver fra bunden hver gang.

---

## Tilgang: ét niveau over den eksisterende editor, ikke en ny datamodel

Der er bevidst **ingen** ny tabel, ny API-rute eller ny "skabelon"-begreb i
D1. En skabelon er en fast, klient-side liste af {navn, ugedage, opgaver}
(`features/tasks/routineTemplates.ts`), som blot udfylder felterne i den
allerede eksisterende rutine-editor (`RoutineCreateDialog` i
`pages/TasksPage.tsx`) — nøjagtig samme mekanisme, som AI-forslaget
(`onSuggest`) allerede bruger til at udfylde navn og opgaver. Brugeren kan
frit redigere alle felter bagefter, ligesom efter et AI-forslag, og kan
også overskrive en skabelon med et AI-forslag eller omvendt.

Fire skabeloner, valgt ud fra roadmap-dokumentets eksplicitte liste:

- **Morgenrutine** (hverdage): Stå op, Børst tænder, Tag tøj på, Spis
  morgenmad.
- **Skoletaske** (hverdage): Madpakke, Bøger og lektier, Idrætstøj (hvis
  idræt i dag), Underskrevne sedler.
- **Tandbørstning** (alle dage): Børst tænder morgen (07:30) og aften
  (19:30) som to separate opgaver med hver sin påmindelsestid.
- **Sengetid** (alle dage): Tag pyjamas på, Børst tænder, Læg tøj klar til
  i morgen, Sluk lys.

Ugedagene er et forslag, ikke bindende — de er blot forudvalgt i
ugedags-vælgeren og kan ændres før oprettelse, ligesom resten af
skabelonens felter.

---

## Afgrænsning

- Ingen ny konfigurationsmulighed for at redigere/tilføje skabeloner selv
  — de er en fast liste, ligesom `taskIcons.ts`'s ikonsæt. Kan udvides
  senere med en selvstændig beslutning, hvis behovet opstår.
- Ingen ændring af serveren — hele funktionen er klient-side UI oven på
  den eksisterende `POST /task-routines`-rute.

---

## Verifikation

- `npx tsc -b --force`, `npm run lint`, `npx vitest run` — ingen
  regressioner (ingen ny server-kode at teste).
- Nyt Playwright-scenarie (`e2e/app-smoke.spec.ts`): vælger
  "Sengetid"-skabelonen og verificerer, at navn og opgavefelter udfyldes
  korrekt, samt at rutinen kan oprettes og vises herefter.
