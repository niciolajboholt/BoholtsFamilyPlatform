# 05_Sprint_History

> Status: Active

Version: 1.4

Project:
Boholts Family Platform

Last Updated:
2026-08-13 (Sprint 16–18 samt unavngivet planlægger-arbejde eftertilføjet)

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

## Sprint 15 — Redigerbare familiemedlemmer (2026-07-29)

- Familiemedlemmer er dynamisk, localStorage-baseret data (`familyMembersStorage.ts`, `useFamilyMembers`-hook) i stedet for en fast, kompileringstids-kendt liste — kan tilføjes, redigeres og slettes via en ny `FamilyMemberDialog` på Indstillinger-siden.
- Felter: navn, relation (dropdown Far/Mor/Barn/Andet), farve (8 faste swatches).
- "Familien" forbliver en reserveret pseudo-profil: kun farven kan ændres, aldrig navn eller sletning.
- Sletning af et medlem flytter automatisk deres eksisterende aftaler til "Familien" (`CalendarService.reassignOwner`) i stedet for at efterlade dem forældreløse.
- **Bug rettet undervejs**: `EventList.tsx` og `WeekCalendar.tsx` slog farve op via en kilde-farve-funktion på et person-id, så deltager-chips altid faldt tilbage til grå. Ny fælles `getEventOwnerColor()` bruges nu konsekvent i `EventList`, `WeekCalendar` og `DayCell`.
- Lokale kalenderkilder (én pr. medlem) beregnes nu pr. kald i stedet for én gang ved modul-indlæsning, så et nyt medlem får sin egen kalender uden genindlæsning.
- **Opfølgning samme dag**: "Forbind til Google" flyttet udelukkende til Indstillinger — Kalender-siden viser nu kun forbindelsesstatus, ingen handling.
- 15 nye tests (47 i alt).

---

## Sprint 16 — Gentagne aftaler (2026-07-29)

- Fuldt Apple Calendar-stil gentagelsesmønster: ugentligt med flere ugedage, månedligt datotal eller ugedag-i-position inkl. "Første & sidste".
- Enkelt-forekomst-redigering/-sletning af gentagne aftaler.
- Google-gentagelser vises nu også (`recurrenceMasterId`).
- Merget til `develop` samme dag som en ekstern audit (Codex) gennemgik branchen og gav **NO-GO** med 17 fund (F-01 til F-17). Stabiliseringsarbejdet (Fase 0–3) blev udført 2026-07-29–30 og lukkede alle fund undtagen to bevidst udskudte (se [10_Future_Roadmap](10_Future_Roadmap.md)). En valideret `develop` blev merget til `main` 2026-07-30.

---

## Sprint 17 — Førstegangs-onboarding (ADR-015, 2026-07-31)

- Seed-data ændret fra hardcodede Boholt-navne til generiske placeholders (Far/Mor/Barn 1/Barn 2/Familien), markeret med `isPlaceholderName`.
- Ny `FamilySetupOnboarding.tsx` vises ved første åbning, styret af om familiemedlemmer nogensinde er gemt i `localStorage`.
- Familie-pseudomedlemmets navn kan nu redigeres og driver AppBar-overskrift/fanetitel.
- Ved tildeling af en Google-kalender med uændret placeholder-navn tilbydes brugeren at overtage Googles rigtige kalendernavn.

---

## Sprint 18 — Outlook Kalender (ADR-016, 2026-07-31)

- Outlook-provider-stak (`providers/outlook/`) bygget som spejl af Google-stakken: MSAL.js mod Microsoft Graph, samme mapper-/tildelingsmønster.
- Redirect-login i stedet for pop-up (pop-up hang på iPhone/Safari/PWA).
- `CompositeCalendarProvider`, kalender-valg-dialogen og forbindelsesbanneret generaliseret til at understøtte flere eksterne providers, ikke kun Google.
- Apple Kalender bevidst udskudt — kræver appens første server-komponent (CalDAV-proxy).
- **Status:** integrationen virker, men er **midlertidigt slået fra i kode** (`outlookCalendarConfig.ts`), da Nicolajs arbejdsgivers Entra-tenant kræver IT-godkendelse, som endnu ikke er givet.

---

## Kalenderplanlægger og dagsvisning (2026-08-01, uden sprintnummer)

- Ny time-for-time dagsvisning.
- Ny "side-by-side" familieplanlægger (medlemmer som kolonner, sticky ugebånd, ægte bidirektionel uendelig scroll), bygget efter et referencescreenshot fra Nicolaj.
- Ugevisningens redundante agenda-liste under kalendergitteret fjernet (månedsvisning beholder sin, da cellerne der viser langt mindre detalje).
- **Bemærk:** dette arbejde blev aldrig givet et formelt sprintnummer i dokumentationen, selvom kodekommentarer i Sprint 17/18-filerne antyder en fortløbende, uformel nummerering. Behandles her som direkte fortsættelse af Sprint 18.

---

## Status ved seneste opdatering

Sprint 0 til 18 (samt det unavngivne planlægger-/dagsvisningsarbejde) er merget til `main` (seneste: v1.1, 2026-08-10). Outlook-integrationen (Sprint 18) er bygget, men står bevidst deaktiveret i kode, indtil IT-godkendelse foreligger hos Nicolajs arbejdsgiver. Ingen af de planlagte Fase 2–4-funktioner (se [10_Future_Roadmap](10_Future_Roadmap.md)) er påbegyndt endnu — herunder "Flere Google-konti pr. familie", som kræver en selvstændig ADR og planlægningsrunde. Vitest dækker fortsat kun rene funktioner (Google/Outlook-mappere, familie-/lager-hooks) — React-komponenter/hooks har ingen automatiseret test. Se [08_Development_Standards](08_Development_Standards.md).

---

## Dokumentets rolle

Dette dokument opdateres ved afslutningen af hvert sprint med en kort, faktuel beskrivelse af hvad der blev leveret.
