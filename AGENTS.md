# AGENTS.md — Boholts Family Platform

## Formål og produktretning

Boholts Family Platform skal give børnefamilier et samlet, enkelt overblik over familiens aftaler. Kalenderen er produktets centrum, og løsningen følger et offline-first princip.

Produktretningen er **Apple First, ikke Apple Only**: den langsigtede primære oplevelse er native Apple (iPhone og iPad), mens den aktuelle webimplementering er en POC, der skal bevare adskillelsen mellem UI, forretningslogik, datamodel og integrationer.

## Aktuel applikation

- Webappen ligger i `05_App/web`.
- Den er bygget med React, TypeScript, Vite og Material UI.
- `vite-plugin-pwa` er installeret som den planlagte PWA-teknologi, men er endnu ikke konfigureret i `vite.config.ts`. Påstå ikke, at service worker eller offline-cache er aktiv, før konfiguration og verifikation er tilføjet.
- Brugergrænsefladen og fejltekster er på dansk. Bevar dansk UI-tekst.
- Lokale brugeroprettede kalenderaftaler gemmes i browserens `localStorage` via `CalendarService`. Seed-data ligger separat i `data/calendarEvents.ts`.

## Kalenderdomæne

`CalendarEvent` ligger i `05_App/web/src/features/calendar/models/calendarEvent.ts` og indeholder blandt andet `id`, titel, start, slut, heldagsflag, deltagere, kilde, valgfri metadata og valgfri `recurrence`.

- En aftale uden `recurrence` er en almindelig enkeltstående aftale og skal fortsat fungere uændret.
- `RecurrenceRule` understøtter frekvens, interval, afslutning, ugedage, månedsdag og måned.
- Design af datoer, tidszoner og gentagelser skal være kompatibelt med RFC 5545-principper: en serie har en start, et interval og et veldefineret slutvilkår; undgå datatabende eller UI-specifikke formater i domænemodellen.
- Google Calendar-synkronisering er fremtidigt arbejde. Hold kalenderlogik og lagring adskilt fra UI, så en integrationsadapter kan tilføjes uden at omskrive komponenterne.

## Arbejdsgang

- Arbejd aldrig direkte på `main`.
- Branchestrategi: `main` er stabil, `develop` samler godkendte ændringer, og arbejde udføres på `feature/*`-grene. Er den aktuelle gren ikke passende for opgaven, foreslå eller opret en sikker `feature/*`-gren før implementering.
- Bevar eksisterende arkitektur og genbrug etablerede mønstre, typer, services og hjælpefunktioner, før der oprettes nye.
- Hold ændringer små og fokuserede. Lav små, meningsfulde commits; commit og push kun efter udtrykkelig godkendelse.
- Tilføj ikke store afhængigheder eller nye platforme uden godkendelse.
- Kør mindst `npm run build` fra `05_App/web` efter kodeændringer. Kør også relevante lint- og testkommandoer, når de findes eller berøres.
- Rapportér ændrede og nye filer samt de kontroller, der er kørt.

## Kilder og konfliktløsning

Den eksisterende dokumentation beskriver både den langsigtede native SwiftUI/SwiftData-arkitektur og den aktuelle React-web-POC. Bevar begge spor og behandl dem som henholdsvis produktretning og aktuel implementering. Stop og bed om afklaring, hvis en opgave kræver, at de samme lag eller funktioner implementeres på modstridende måder.

Vigtige kilder:

- `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`
- `01_Project_Documentation/Architecture/09_Data_Model.md`
- `01_Project_Documentation/Architecture/11_Google_Calendar_Integration.md`
- `01_Project_Documentation/Architecture/18_Google_Calendar_Sync_Engine.md`
- `05_App/web/src/features/calendar/`
