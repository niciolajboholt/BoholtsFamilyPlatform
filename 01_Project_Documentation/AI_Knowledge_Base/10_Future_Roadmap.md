# 10_Future_Roadmap

> Status: Active

Version: 1.7

Project:
Boholts Family Platform

Last Updated:
2026-07-29 (ekstern audit-stabiliseringsmilepæl tilføjet)

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

**Status: I gang. Blokerer nye feature-sprints (inkl. resten af Sprint 16), indtil Fase 0 og 1 er gennemført.**

En ekstern, uafhængig audit (Codex, revision 2, 2026-07-29) gennemgik `main`, `develop` (commit `9647722`) og den daværende lokale Sprint 16-arbejdstilstand. Samlet konklusion: **NO-GO** til release, med 17 konkrete fund (F-01 til F-17), hvoraf 5 vurderes kritiske/blokerende. Den fulde rapport samt en uafhængig vurdering og eksekveringsplan er udarbejdet uden for repoet sammen med Nicolaj; denne sektion er det autoritative uddrag i Knowledge Base, så begge AI-agenter arbejder fra samme grundlag.

**Vigtigste fund**: forkert default branch/`main` uden webapp (F-01), Sprint 16 fejler lint/build pga. 3 ubrugte imports (F-02), kalenderen låser permanent i React Strict Mode-dev (F-03), PWA/offline er kun installeret, ikke konfigureret (F-04), Google-hentning bruger ugyldige RFC3339-år og er ineffektiv (F-05), ingen fælles "single source of truth" mellem lokale og Google-events (F-06), ingen CI (F-07), manglende release-/sikkerhedsgrundlag (F-08), kun single-device (F-09), samt en række mellem-fund (F-10 til F-17: mock-UI på dashboard, manglende localStorage-migration/backup, `reassignOwner` glemmer at omskrive `sourceId` ved medlemssletning, ufærdig recurrence, forældet dokumentation, manglende kravsporbarhed, delvis a11y/UX, encoding-fejl).

**Koordinering mellem agenter**: Fase 0 og 1 udføres på to selvstændige branches forgrenet fra denne opdaterede `develop`, én pr. AI-agent, for at undgå at redigere de samme filer samtidig. Se Decision_Log for branch-tildeling. Hver opgave nedenfor committes enkeltvis og merges kun når `lint`/`build`/`test` er grønne.

### Fase 0 — Stabilisering (mekaniske rettelser, ingen arkitekturbeslutning nødvendig)

1. `index.html`: `lang="en"` → `lang="da"`, titel "web" → retvisende titel (F-16).
2. Ret UTF-8-encodingfejl `indlÃ¦ses` → `indlæses` i `GoogleCalendarApi.ts` og `GoogleCalendarSession.ts` (F-17).
3. Fjern eller færdiggør de 3 ubrugte imports i `CalendarPage.tsx` (`useRecurrenceExceptions`, `CalendarEventRange`, `expandRecurringEvents`), så `lint`/`build` er grønne igen (F-02).
4. Gør `useCalendarSources.ts` og `useCalendarEvents.ts` idempotente under React Strict Mode — erstat det delte "in progress"-ref med `AbortController`/generation-id, så et nyt mount ikke blokeres af det forrige. Test i faktisk `npm run dev`, ikke kun preview (F-03).

### Fase 1 — Repo- og CI-hygiejne

1. Opret `.github/workflows/ci.yml`: `npm ci` → lint → build → test på push/PR (F-07).
2. Ret `local:family`-select-state og den tilhørende MUI-advarsel (F-03, del 2).
3. Ret `CalendarService.reassignOwner()` (ca. linje 560), så både `ownerIds` og `sourceId` omskrives atomisk ved medlemssletning. Tilføj regressionstest (F-12).
4. Beslut branch-strategi: merge en valideret `develop` til `main` (anbefalet), eller skift default branch bevidst. Opdatér `README.md`/`PROJECT_STATUS.md` så de matcher den faktiske React-stack, ikke SwiftUI/SwiftData (F-01, F-14).

### Fase 2 — Beslutningspunkter (afklares før videre kodning)

- Datamodel: localStorage → IndexedDB, event-identitet, tombstones til slettede poster, konfliktpolitik (F-06, F-11).
- Google-sync: gyldigt, begrænset tidsvindue plus `nextSyncToken`/inkrementel sync, fælles source-cache mellem hooks (F-05).
- Dashboard/mock-UI: bind `HomePage.tsx` til rigtige data, eller fjern ikke-implementerede handlinger (Indkøbsliste, Opgaver, "Ny aftale") tydeligt (F-10).

### Fase 3 — Milepæle (afhænger af Fase 2's beslutninger)

- PWA: manifest, service worker, offline-scope defineret af datamodel-beslutningen (F-04).
- Recurrence: begræns til understøttet delmængde, eller færdiggør `byWeekdays`/`byMonthDay`/`byMonth` i selve ekspansionen — hænger sammen med Sprint 16 ovenfor (F-13).
- Komponent-/hook-tests i Strict Mode, 3-5 kritiske Playwright-flows, krav-ID'er og sporbarhedsmatrix (F-07 del 2, F-15).
- Google-livetest med dedikeret testkonto samt fysisk iPhone/Safari/VoiceOver-test (kræver fysisk adgang, kan ikke gøres af en AI-agent alene).

**Sporbarhed**: opret ét GitHub Issue pr. fund-ID (F-01 til F-17), så hver commit/PR kan referere `Fixes F-xx`.

---

## Sprint 15 — Gennemført

Personlige farver, redigerbare familiemedlemmer (navn, relation, farve) og tilføj/slet-medlem. Se [05_Sprint_History](05_Sprint_History.md) for detaljer.

---

## Sprint 16 — Planlagt: Gentagne aftaler

**Status: Planned.**

**Ønske fra Nicolaj (2026-07-29)**: to fremtidige funktioner blev bedt om forberedt til planlægning samtidig — gentagne aftaler ("gentagende aftaler") og understøttelse af flere Google-kalendre/konti (fx Christines egen konto, ud over Nicolajs). Efter undersøgelse af begge anbefales det at adskille dem: gentagne aftaler som Sprint 16, flere Google-konti som et separat, senere sprint med egen ADR — se begrundelse under "Flere Google-konti pr. familie" nedenfor.

**Baggrund**: En gentagelses-datamodel findes allerede fuldt defineret — `RecurrenceRule`, `RecurrenceFrequency`, `RecurrenceEndType` og `CalendarWeekday` i `models/calendarEvent.ts`, samt fuld validering (`isRecurrenceFrequency`, `isRecurrenceRule`) i `CalendarService.ts`. Men der findes **ingen UI** til at sætte en gentagelsesregel, og **ingen kode nogen steder** der "udfolder" (expanderer) en gentagelsesregel til konkrete forekomster i kalendervisningerne (`getEventsForDate.ts`, `getEventsForWeek.ts`, `MonthCalendar`, `WeekCalendar`, `DayCell`, dialogerne). Modellen er med andre ord 100% klar i data-laget, men 0% synlig for brugeren — bekræftet ved gennemsøgning af hele `src`.

**Sprintindhold** (forslag, kan justeres inden sprinten sættes i gang):
1. UI til at sætte en gentagelsesregel i `NewEventDialog`/`EditEventDialog`: frekvens (dagligt/ugentligt/månedligt/årligt), interval, og hvornår gentagelsen slutter (aldrig/til dato/antal gange). Modellen understøtter allerede `byWeekdays`/`byMonthDay`/`byMonth`, men disse kan udelades af selve UI'en i første omgang for at holde omfanget nede — kun de simple, hyppigst brugte mønstre medtages.
2. En ren occurrence-expansion-funktion: givet en `CalendarEvent` med `recurrence` og et datointerval (den viste uge/måned), returnér de konkrete forekomster i intervallet. Google-events med gentagelse filtreres i dag bevidst fra ved læsning (Sprint 11.1) — denne sprint bør enten genoverveje det, eller eksplicit fastlægge at kun lokale gentagne events understøttes for nu.
3. Redigering/sletning af én enkelt forekomst kræver et valg ("kun denne" vs. "alle") og formentlig en ny data-struktur til undtagelser fra en gentagelsesregel — dette er sprintens mest kompleksitets-tunge del og bør afklares med Nicolaj, inden sprinten sættes i gang.
4. Tests for expansion-logikken (en ren funktion, let at teste isoleret — samme tilgang som mapper-testene fra Sprint 13).

**Kritiske filer**: `models/calendarEvent.ts` (uændret, allerede korrekt), `services/CalendarService.ts`, ny fil til occurrence-expansion (fx `utils/expandRecurrence.ts`), `NewEventDialog.tsx`/`EditEventDialog.tsx`, `getEventsForDate.ts`/`getEventsForWeek.ts`, kalendervisningerne.

**Åbne spørgsmål, der bør afklares med Nicolaj inden sprinten sættes i gang**:
- Skal Google-events med gentagelse fortsat filtreres fra ved læsning, eller skal de nu udfoldes?
- Skal redigering af "kun denne forekomst" understøttes fra start, eller kan sprintens første version nøjes med at redigere/slette hele gentagelsesrækken ad gangen (simplere, men mindre fleksibelt)?

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
