# Sprint 7 — Codex handover

**Status:** Delvist færdig (Sprint 7.2)
**Aktuel gren:** `develop`
**Sidst opdateret:** 2026-07-27

## Formål

Sprint 7 indfører datamodellen og fundamentet for gentagende kalenderaftaler i den aktuelle React/TypeScript-webapp. Arbejdet skal bevare eksisterende enkeltstående aftaler og forberede senere UI, forekomstgenerering og Google Calendar-synkronisering.

## Færdigt

- `CalendarEvent` understøtter `RecurrenceRule` som et valgfrit felt.
- Gentagelsesfrekvenserne `daily`, `weekly`, `monthly` og `yearly` er defineret.
- `interval` er understøttet.
- Afslutningstyperne `never`, `until` og `count` er understøttet.
- `byWeekdays`, `byMonthDay` og `byMonth` er understøttet.
- `CalendarService` validerer og gemmer recurrence i `localStorage`.
- `npm run build` bestod efter Sprint 7.2.

## Ikke færdigt

- Recurrence-felter i `NewEventDialog`.
- Recurrence-felter i `EditEventDialog`.
- Generering af forekomster.
- Visning af forekomster i uge-, måned- og dagsvisning.
- Konfliktkontrol på genererede forekomster.
- Redigering og sletning af enkeltforekomst kontra hele serien.
- Tests og slutdokumentation.

## Nuværende implementering

- Domænemodel: `05_App/web/src/features/calendar/models/calendarEvent.ts`.
- Validering og lokal lagring: `05_App/web/src/features/calendar/services/CalendarService.ts`.
- Eksisterende aftaler uden `recurrence` skal behandles som enkeltstående aftaler uden ændret adfærd.
- Gentagelsesmodellen må videreudvikles efter RFC 5545-principper. Før generering implementeres, skal der træffes en eksplicit beslutning om tidszone, all-day-semantik, månedslængder og identitet for genererede forekomster.
- Google Calendar-synkronisering er ikke implementeret. Kalenderlogik skal fortsat holdes fri af direkte API-kald i UI-komponenter.

## Vurdering: NewEventDialog og EditEventDialog

Ja. Begge dialoger bør opdeles, før recurrence-UI tilføjes. `NewEventDialog.tsx` er ca. 842 linjer og `EditEventDialog.tsx` ca. 1.029 linjer; de indeholder næsten ens formstate, dato-/tidskonvertering, validering, deltager-vælger og konfliktvisning.

Anbefalet, afgrænset næste refaktorering (uden at ændre adfærd):

1. Udtræk fælles `EventFormState` og dato-/tidsfunktioner til en kalender-formularmodul.
2. Udtræk en `useEventForm`-hook til initialisering, validering, deltagerændringer og opbygning af konfliktkandidat.
3. Udtræk præsentationskomponenter til basale felter, deltager-vælger, tidspunkt og konfliktadvarsel.
4. Behold oprettelses-, opdaterings- og sletteorkestrering i de respektive dialog-containere.
5. Tilføj recurrence-sektionen oven på det fælles formularlag, når den eksisterende adfærd er dækket af tests eller manuel verifikation.

Denne opdeling reducerer dobbeltlogik og gør recurrence-felter konsistente mellem oprettelse og redigering. Den er ikke implementeret som del af dette handover.

## Verifikation ved næste ændring

Kør fra `05_App/web`:

```powershell
npm run build
npm run lint
```

Rapportér desuden ændrede/nye filer og testresultater. Arbejd ikke direkte på `main`; fortsat implementering bør ske på en dedikeret `feature/*`-gren fra `develop`.
