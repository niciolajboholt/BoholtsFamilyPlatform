# 05_Sprint_History

> Status: Active

Version: 1.2

Project:
Boholts Family Platform

Last Updated:
2026-07-28 (Sprint 14)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument beskriver udviklingen sprint for sprint, baseret på projektets faktiske commit-historik. Det supplerer [04_Project_History](04_Project_History.md) med et mere detaljeret, kronologisk overblik.

---

## Sprint 0 — App-fundament (2026-07-26)

- Initialisering af React/TypeScript-webapp.
- UI-routing og PWA-afhængigheder tilføjet.
- Første app-skal og navigation.

---

## Sprint 1 — Dashboard og designsystem (2026-07-27)

- Dashboard og familie-designsystem tilføjet.

---

## Sprint 2–3 — Kalenderfundament (2026-07-27)

- Kalender-event-model.
- Visning af events pr. dato, med filtrering på dato og familiemedlem.
- Ejerskabs-metadata (owner) pr. event.
- Kalender indlæses gennem en service, senere gennem en hook, og gøres asynkron.
- Ugefiltrering og interaktiv måneds- og ugevisning.
- Lokal persistence af events (localStorage).
- Sprint 3 markeres afsluttet med et samlet "complete Sprint 3 calendar foundation"-commit.
- Event-redigering og -sletning tilføjes.
- Gentagelsesmodel (recurrence) og validering i `CalendarService`.

---

## Sprint 8 — Dialog-refaktorering (2026-07-28)

Formålet var at gøre event-dialogerne (opret/redigér) vedligeholdbare ved at bryde dem op i genanvendelige dele:

- Fælles formular-utilities udskilt.
- `useEventFormState`, `useEventConflicts`, `useEventValidation` udskilt som selvstændige hooks.
- `EventConflictAlert`, `EventDateTimeSection`, `EventParticipantsSection` udskilt som komponenter.
- Efterfølgende forbedringer: validerings-feedback, advarsel ved ikke-gemte ændringer, kalenderen initialiseres på dags dato, forbedrede tilgængelige (accessible) kalenderinteraktioner, bedre loading- og fejltilstande.

---

## Sprint 10 — Calendar Provider-arkitektur (ADR-007, 2026-07-28)

- `CalendarProvider`-interface indført som leverandøruafhængig kontrakt.
- `LocalCalendarProvider` som adapter over den eksisterende `CalendarService`.
- `CompositeCalendarProvider` som fælles indgangspunkt, der kan samle flere kilder.
- Kalenderkilde-synlighed og -farver tilføjet og efterfølgende centraliseret.

---

## Sprint 11.1 — Google Calendar, skrivebeskyttet (ADR-008, 2026-07-28)

- `GoogleCalendarProvider`, `GoogleCalendarApi` og `GoogleCalendarSession` tilføjet.
- Google-kilder og -events namespaces med URL-encodede id'er, adskilt fra lokale id'er via `sourceId`.
- Scope: `calendar.readonly`. OAuth-token holdes udelukkende i hukommelsen — ingen backend eller refresh-token.
- Lokale events uden `sourceId` normaliseres automatisk og falder tilbage til `local:family`.

---

## Sprint 12.1 — Google Calendar, skriveadgang (ADR-009, 2026-07-28)

- Skriveadgang til Google Calendar tilføjet: oprettelse og redigering af events direkte i brugerens Google-kalendere.
- Mindst mulige rettigheder: scopes `calendar.events` og `calendar.calendarlist.readonly`.
- `CompositeCalendarProvider` router writes via `sourceId`; skriverettighed afgøres udelukkende af CalendarList `accessRole`.
- Bevidst udskudt: deltagere (attendees), redigering af gentagne events, og en persistent (ikke memory-only) Google-forbindelse.
- **Efterfølgende rettelser (samme dag, ved kodegennemgang)**: To tidszone-fejl fundet og rettet i heldagsaftale-håndteringen — skriv-siden sendte en dato en dag for tidligt til Google, og læse-siden viste Google-heldagsaftaler på én dag for meget. Begge skyldtes at UTC-baseret datoparsing blev blandet med appens lokal-midnat-konvention. Rettet i `googleCalendarWriteMapper.ts`/`googleCalendarMapper.ts`.

---

## Sprint 13 — Stabilisering og kvalitet (2026-07-28)

- De 3 kendte lint-fejl (`react-hooks/set-state-in-effect`) rettet: dialog-nulstilling flyttet fra effects til render-fasen (`NewEventDialog`, `EditEventDialog`); en målrettet, begrundet undertrykkelse for opstarts-hentningen i `useCalendarEvents`.
- Vitest indført som testramme. 29 tests for de rene Google-mapper-funktioner, inkl. regressionstest for de to tidszone-fejl fra Sprint 12.1.
- **ADR-010**: formaliserer platformskiftet fra Swift/SwiftUI til React/TypeScript/PWA — se `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`.
- Google-forbindelsens UX forbedret: "Genforbind"-tekst efter sessionsafbrud (via et ikke-følsomt localStorage-hint), synlig "forbinder"-tilstand, og SettingsPage's tidligere hardcodede/forkerte forbindelseskort rettet til at vise reel status.

---

## Sprint 14 — Stille genoprettelse af Google-forbindelsen (2026-07-28)

- `GoogleCalendarSession.attemptSilentReconnect()`: forsøger et usynligt token-genkald (`prompt: ""`) ved appstart, hvis brugeren har forbundet før. Kappet af en 4-sekunders tidsgrænse via en selvstændig, testet `raceWithTimeout`-hjælpefunktion, så det aldrig kan hænge UI'et.
- Falder korrekt tilbage til Sprint 13's "Genforbind"-flow, hvis det stille forsøg ikke lykkes.
- Ny "Genopretter forbindelsen..."-status i både `GoogleCalendarConnection` og SettingsPage.
- 3 nye tests for `raceWithTimeout` (32 tests i alt).
- **Kendt begrænsning**: Google's klientbibliotek kan falde tilbage til et pop op-vindue, hvis den fuldt stille vej ikke er tilgængelig — og browsere blokerer pop op-vinduer, der ikke er udløst af et brugerklik. I så fald sker der intet galt (falder blot tilbage til "Genforbind"), men reel succesrate afhænger af brugerens aktive Google-session og er ikke fuldt verificerbar uden en rigtig konto.
- Bevidst fravalgt: en backend/refresh-token-løsning — vurderet uforholdsmæssig for en app med 2-4 brugere (se [10_Future_Roadmap](10_Future_Roadmap.md)).

---

## Status ved seneste opdatering

Sprint 0 til 14 er merget ind i `develop`. Ingen af de planlagte Fase 2–4-funktioner (se [10_Future_Roadmap](10_Future_Roadmap.md)) er påbegyndt endnu. Vitest er indført (Sprint 13), men dækker kun de rene Google-mapper-funktioner — React-komponenter/hooks har fortsat ingen automatiseret test. Se [08_Development_Standards](08_Development_Standards.md).

---

## Dokumentets rolle

Dette dokument opdateres ved afslutningen af hvert sprint med en kort, faktuel beskrivelse af hvad der blev leveret.
