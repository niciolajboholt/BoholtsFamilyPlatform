# 10_Future_Roadmap

> Status: Active

Version: 1.9

Project:
Boholts Family Platform

Last Updated:
2026-07-30 (alle 17 audit-fund gennemgået — 15 løst/udført, F-05 og F-16 delvist løst med resterende dele eksplicit dokumenteret som åbne)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument samler den planlagte udviklingsretning fra `Product/07_Product_Roadmap.md` og `Development/19_Release_Plan.md`, så den er tilgængelig ét sted i Knowledge Base.

---

## Nuværende status

Fase 1 (Proof of Concept) er delvist gennemført: familieoverblik, kalendervisning, og opret/redigér/slet af aftaler findes. Google Calendar-integration er gennemført med både læse- og skriveadgang samt stille genoprettelse ved appstart (ud over hvad Fase 1 oprindeligt krævede). Sprint 13 tilføjede automatiseret test (Vitest) og formaliserede platformstrategien som ADR-10. Sprint 15 gjorde familiemedlemmer til dynamisk, redigerbar data (navn, relation, farve, tilføj/slet) i stedet for en fast liste. Se [05_Sprint_History](05_Sprint_History.md).

Ikke inkluderet endnu, som forudsat i Release Plan: login, deling mellem brugere, push-notifikationer, widgets.

---

## Stabiliseringsmilepæl — ekstern audit (2026-07-29)

**Status: Fase 0, 1 og 2 er gennemført (2026-07-30). Fase 3 er gennemført med to bevidste undtagelser: `nextSyncToken`/inkrementel Google-sync (del af F-05) og komponent-/hook-tests i Strict Mode samt Playwright-flows (F-07 del 2) er ikke påbegyndt — vurderet som lavere prioritet nu hvor kerneproblemerne er løst. Fysisk iPhone/Safari/VoiceOver-test (F-16) kræver Nicolajs egen fysiske enhed og kan ikke udføres af en AI-agent.**

En ekstern, uafhængig audit (Codex, revision 2, 2026-07-29) gennemgik `main`, `develop` (commit `9647722`) og den daværende lokale Sprint 16-arbejdstilstand. Samlet konklusion: **NO-GO** til release, med 17 konkrete fund (F-01 til F-17), hvoraf 5 vurderes kritiske/blokerende. Den fulde rapport samt en uafhængig vurdering og eksekveringsplan er udarbejdet uden for repoet sammen med Nicolaj; denne sektion er det autoritative uddrag i Knowledge Base, så begge AI-agenter arbejder fra samme grundlag.

**Vigtigste fund**: forkert default branch/`main` uden webapp (F-01), Sprint 16 fejler lint/build pga. 3 ubrugte imports (F-02), kalenderen låser permanent i React Strict Mode-dev (F-03), PWA/offline er kun installeret, ikke konfigureret (F-04), Google-hentning bruger ugyldige RFC3339-år og er ineffektiv (F-05), ingen fælles "single source of truth" mellem lokale og Google-events (F-06), ingen CI (F-07), manglende release-/sikkerhedsgrundlag (F-08), kun single-device (F-09), samt en række mellem-fund (F-10 til F-17: mock-UI på dashboard, manglende localStorage-migration/backup, `reassignOwner` glemmer at omskrive `sourceId` ved medlemssletning, ufærdig recurrence, forældet dokumentation, manglende kravsporbarhed, delvis a11y/UX, encoding-fejl).

**Koordinering mellem agenter**: Fase 0 og 1 udføres på to selvstændige branches forgrenet fra denne opdaterede `develop`, én pr. AI-agent, for at undgå at redigere de samme filer samtidig. Se Decision_Log for branch-tildeling. Hver opgave nedenfor committes enkeltvis og merges kun når `lint`/`build`/`test` er grønne.

### Fase 0 — Stabilisering (mekaniske rettelser, ingen arkitekturbeslutning nødvendig)

1. ~~`index.html`: `lang="en"` → `lang="da"`, titel "web" → retvisende titel (F-16).~~ **Løst (2026-07-29, PR #22)**: `lang="da"` og titlen "Boholts Familieapp" er på plads. Den bredere a11y/UX-verifikation (tastaturnavigation, fokus, farve som eneste informationsbærer, fysisk iPhone/Safari/VoiceOver-test) i issue F-16 er fortsat åben — kræver fysisk adgang, jf. Fase 3.
2. ~~Ret UTF-8-encodingfejl `indlÃ¦ses` → `indlæses` i `GoogleCalendarApi.ts` og `GoogleCalendarSession.ts` (F-17).~~ **Løst (2026-07-29, PR #22)**: ingen mojibake tilbage i de nævnte filer.
3. ~~Fjern eller færdiggør de 3 ubrugte imports i `CalendarPage.tsx` (`useRecurrenceExceptions`, `CalendarEventRange`, `expandRecurringEvents`), så `lint`/`build` er grønne igen (F-02).~~ **Løst ved Sprint 16-merge (2026-07-29)**: alle tre bruges reelt (gentagelses-udfoldning), ingen ubrugte imports tilbage — `lint`/`build` bekræftet grønne på `develop` efter merge.
4. ~~Gør `useCalendarSources.ts` og `useCalendarEvents.ts` idempotente under React Strict Mode — erstat det delte "in progress"-ref med `AbortController`/generation-id, så et nyt mount ikke blokeres af det forrige. Test i faktisk `npm run dev`, ikke kun preview (F-03).~~ **Løst ved Sprint 16-merge (2026-07-29)**: fundet under browser-test af Sprint 16 — `useCalendarSources.ts`s delte `isLoadingRef`-guard i mount-effekten kolliderede med StrictMode's dobbelt-kørsel og en separat `isCurrent`-annulleringsflag, så begge forsøg endte med at kassere deres eget resultat, og kalenderen hang permanent på "Indlæser kalendere…". Rettet ved kun at bruge `isLoadingRef` i den manuelle `refresh()`, og lade mount-effekten styre sig via sin egen `isCurrent`-lukning. Verificeret i faktisk `npm run dev`, ikke kun build. `useCalendarEvents.ts` blev gennemgået specifikt af samme grund og vurderet ikke berørt: dens mount-effekt har ingen tilsvarende `isCurrent`-annullering, så dens `isRefreshingRef`-guard forhindrer blot et dublet-kald uden at kassere det første forsøgs resultat — bekræftet empirisk gennem gentagne browser-test, ingen ændring nødvendig.

### Fase 1 — Repo- og CI-hygiejne

1. ~~Opret `.github/workflows/ci.yml`: `npm ci` → lint → build → test på push/PR (F-07).~~ **Løst (2026-07-29, PR #22)**: workflowet findes, kører på push/PR mod `main`/`develop`, med separate trin for install/lint/build/test.
2. ~~Ret `local:family`-select-state og den tilhørende MUI-advarsel (F-03, del 2).~~ **Løst (2026-07-29, PR #22)**: `NewEventDialog` initialiserer nu gyldigt med `local:family`.
3. ~~Ret `CalendarService.reassignOwner()` (ca. linje 560), så både `ownerIds` og `sourceId` omskrives atomisk ved medlemssletning. Tilføj regressionstest (F-12).~~ **Løst (2026-07-29, PR #22)**: begge felter omskrives atomisk, med regressionstest.
4. ~~Beslut branch-strategi: merge en valideret `develop` til `main` (anbefalet), eller skift default branch bevidst. Opdatér `README.md`/`PROJECT_STATUS.md` så de matcher den faktiske React-stack, ikke SwiftUI/SwiftData (F-01, F-14).~~ **Løst (2026-07-30)**: `README.md` opdateret til at afspejle Sprint 0–16 og den igangværende stabilisering (det ikke-eksisterende `PROJECT_STATUS.md`-link er fjernet til fordel for Knowledge Base'en); en valideret `develop` (grøn lint/build/test) merget til `main`, som nu er en releasable default branch.

### Fase 2 — Beslutningspunkter (afklares før videre kodning)

- ~~Datamodel: localStorage → IndexedDB, event-identitet, tombstones til slettede poster, konfliktpolitik (F-06, F-11).~~ **Løst (2026-07-30, ADR-011 + ADR-012)**: single-device forbliver den bevidste model (ADR-011), så de svære, distribuerede spørgsmål (cross-device konflikt/sync) ikke er relevante endnu. `localStorage` fastholdes (ikke IndexedDB) ved den nuværende datamængde; event-identitet, cache-ejerskab, konfliktpolitik ("sidste skriv vinder") og slette-adfærd er dokumenteret i ADR-012. Manuel eksport/import (backup/restore) er implementeret i Indstillinger (`dataBackupStorage.ts`).
- ~~Google-sync: gyldigt, begrænset tidsvindue~~ **(løst 2026-07-30)**: `useCalendarEvents` brugte `allCalendarEventRange` = ECMAScripts dato-yderpunkter (år -271821 til +275760) sendt direkte som `timeMin`/`timeMax` til Google-API'et. Erstattet af `getDefaultCalendarEventRange()` (nu ±1/2 år), med en medfølgende rettelse i `LocalCalendarProvider`, så en lokal gentagende aftales mesterrekord ikke længere falder ud af det snævrere vindue. `nextSyncToken`/inkrementel sync og fælles source-cache mellem hooks er fortsat åbne, større arkitekturbeslutninger (F-05) — bemærk dog at der i dag kun er ét kald til hver af `useCalendarEvents`/`useCalendarSources` (i `CalendarPage.tsx`), så en divergerende cache mellem flere hook-instanser ikke er et aktuelt, observeret problem.
- ~~Dashboard/mock-UI: bind `HomePage.tsx` til rigtige data, eller fjern ikke-implementerede handlinger (Indkøbsliste, Opgaver, "Ny aftale") tydeligt (F-10).~~ **Løst (2026-07-30)**: "Næste aftale", "I dag" og familiens status-grid er nu bundet til `useCalendarEvents`/`useFamilyMembers` (samme gentagelses-udfoldning som `CalendarPage`), med ærlige tomme-tilstande. Indkøbsliste/Opgaver er deaktiveret med et "Snart"-badge i stedet for at fremstå som fungerende. "Ny aftale" var allerede rigtig.

### Fase 3 — Milepæle (afhænger af Fase 2's beslutninger)

- ~~PWA: manifest, service worker, offline-scope defineret af datamodel-beslutningen (F-04).~~ **Løst (2026-07-30)**: `vite-plugin-pwa` var installeret, men aldrig konfigureret. Tilføjet manifest (navn, ikoner, tema-/baggrundsfarver, `lang: "da"`) og en `generateSW`-service worker, der precacher app-skallen. Google Calendar-API og OAuth er eksplicit `NetworkOnly` i cache-strategien, så kalenderdata/adgangstoken aldrig caches. Verificeret via en produktions-preview: service worker registreres, manifest indlæses korrekt. Kendt hul: kun et SVG-ikon findes (bruges til både manifest og apple-touch-icon) — et rigtigt PNG-ikonsæt i flere størrelser er en opfølgning, ikke blokerende. Fysisk iPhone/Safari-installations-/offline-test mangler stadig (se F-16 nedenfor).
- ~~Recurrence: begræns til understøttet delmængde, eller færdiggør `byWeekdays`/`byMonthDay`/`byMonth` i selve ekspansionen — hænger sammen med Sprint 16 ovenfor (F-13).~~ **Løst ved Sprint 16-merge (2026-07-29)**: `byWeekdays` (flere ugedage pr. regel, fx "hver tirsdag og torsdag"), `byMonthDay` (datotal-gitter, samt en ny ordinal ugedag-i-måneden-variant inkl. "Første & sidste") er fuldt implementeret i selve `expandRecurringEvents.ts`-udfoldningen, ikke kun i modellen. `byMonth` for årlig gentagelse er ikke en selvstændigt aflæst variabel i udfoldningen, men resultatet er korrekt, fordi årlig gentagelse regner videre fra den oprindelige aftales egen måned/dag.
- Komponent-/hook-tests i Strict Mode og 3-5 kritiske Playwright-flows er fortsat åbne (F-07 del 2). ~~Krav-ID'er og sporbarhedsmatrix (F-15).~~ **Løst (2026-07-30)**: se `14_Requirements_Traceability.md`.
- Google-livetest med dedikeret testkonto samt fysisk iPhone/Safari/VoiceOver-test (kræver fysisk adgang, kan ikke gøres af en AI-agent alene) — fortsat åbent, del af F-16.

**Sporbarhed**: opret ét GitHub Issue pr. fund-ID (F-01 til F-17), så hver commit/PR kan referere `Fixes F-xx`. Se `14_Requirements_Traceability.md` for den fulde matrix.

**Øvrige fund løst uden for Fase 0-3-listen ovenfor**: F-08 (release-/sikkerhedsgrundlag) er dokumenteret i `13_Release_And_Security_Baseline.md`. F-09 (single-device/flerbruger) er afklaret som ADR-011 — se Fase 2 ovenfor.

---

## Sprint 15 — Gennemført

Personlige farver, redigerbare familiemedlemmer (navn, relation, farve) og tilføj/slet-medlem. Se [05_Sprint_History](05_Sprint_History.md) for detaljer.

---

## Sprint 16 — Gennemført: Gentagne aftaler

**Status: Merget til `develop` (2026-07-29).** Fuldt Apple Calendar-stil gentagelsesmønster (ugentligt med flere ugedage, månedligt datotal eller ugedag-i-position inkl. "Første & sidste"), enkelt-forekomst-redigering/-sletning, og Google-gentagelser vises nu også. Se [05_Sprint_History](05_Sprint_History.md) for detaljer.

---

## Flere Google-konti pr. familie

**Status: Ikke planlagt endnu — kræver egen ADR og planlægningsrunde.**

**Ønske fra Nicolaj**: mulighed for at forbinde flere Google-kalendre/konti til appen, fx så Christine kan forbinde sin egen Google-konto ud over Nicolajs.

**Hvorfor dette er et separat, større sprint end gentagne aftaler**: Google-forbindelsen er i dag bygget som én enkelt, modul-niveau singleton — `export const googleCalendarSession = new GoogleCalendarSession();` i `calendarProviderFactory.ts`. Hele arkitekturen (session, provider, `sourceId`-navngivning) er implicit bygget til præcis én Google-konto ad gangen. At understøtte en anden konto kræver reelt:

- Flere samtidige `GoogleCalendarSession`/`GoogleCalendarProvider`-instanser i stedet for én delt singleton.
- En måde at kode "hvilken konto" ind i `sourceId`/event-routing — i dag adskiller `sourceId` kun kalendere, ikke konti.
- Stillingtagen til, om hver konto forbindes/afbrydes hver for sig (egen knap pr. konto), og hvordan Sprint 14's stille genoprettelse skal fungere, når der er flere konti samtidig.
- Formentlig en ny UI på Indstillinger-siden til at vise/administrere flere forbindelser i stedet for kun én.

Dette vurderes at være en væsentligt større og mere risikofyldt ændring end gentagne aftaler — i samme størrelsesorden som Google-skriveadgang (Sprint 12.1). Anbefaling: behandl det som et selvstændigt fremtidigt sprint med egen ADR (jf. ADR-009), og planlæg det for sig, når gentagne aftaler er afsluttet.

---

## Fase 2 — MVP

- ~~Personlige farver og redigerbare familiemedlemmer~~ — se Sprint 15 ovenfor.
- ~~Gentagne aftaler~~ — se Sprint 16 ovenfor (planlagt).
- Familie-tidslinje.
- Konfliktvisning.
- Notifikationer.

---

## Fase 3 — Udvidelser

- Apple Calendar-integration.
- Outlook-integration.
- Widgets.
- Apple Watch.

---

## Fase 4 — Family OS

- Opgavestyring.
- Madplanlægning.
- Indkøbslister.
- AI-familieassistent.

---

## Versionsplan (jf. Release Plan)

- **v1.0**: Familieoversigt, kalender, Google Calendar, offline first, agenda-, uge- og månedvisning, opret/redigér/slet aftaler, familieprofiler.
- **v1.1**: Widgets, Apple Calendar, hurtige handlinger, flere kalenderfiltre.
- **v1.2**: Opgaver, indkøbsliste, påmindelser, gentagne aftaler.
- **v2.0**: Budget, madplan, dokumenter, ferieplanlægning, AI-assistent.

---

## Åbne strategiske spørgsmål

1. ~~**Platformstrategi**~~ — **Afklaret i Sprint 13**: formaliseret som ADR-010. Projektet er React/TypeScript/PWA, med Apple First som oplevelsesstrategi, ikke teknologikrav. Se [04_Project_History](04_Project_History.md) og `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`.
2. **Teststrategi** — **Delvist afklaret i Sprint 13**: Vitest indført, med regressionsdækning af de rene Google-mapper-funktioner. React-komponenter/hooks har fortsat ingen automatiseret test. Se [08_Development_Standards](08_Development_Standards.md).
3. ~~**Persistent Google-forbindelse**~~ — **Gennemført i Sprint 14**: en backend/refresh-token-løsning er bevidst fravalgt (omkostning/drift ikke proportional med 2-4 brugere). I stedet er stille genoprettelse ved appstart implementeret, med fald tilbage til det eksisterende "Genforbind"-flow. Se [05_Sprint_History](05_Sprint_History.md). Dette er en endelig arkitekturbeslutning, ikke kun udskudt.
4. **Flere Google-konti pr. familie** — rejst af Nicolaj sammen med Sprint 16-ønsket. Kræver at singleton-arkitekturen omkring `GoogleCalendarSession` erstattes af flere samtidige sessioner, samt en ny ADR. Se "Flere Google-konti pr. familie" ovenfor. Ikke planlagt endnu.

---

## Dokumentets rolle

Dette dokument beskriver den planlagte, endnu ikke gennemførte udvikling. Når en fase eller version påbegyndes, flyttes den til [05_Sprint_History](05_Sprint_History.md) med faktisk status.
