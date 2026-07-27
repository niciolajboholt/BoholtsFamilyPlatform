# Contributing to Boholts Family Platform

## Før du ændrer kode

1. Læs `AGENTS.md`, relevant projekt- og arkitekturdokumentation samt den berørte kode.
2. Kontrollér gren og arbejdstræ med `git status --short --branch`.
3. Arbejd aldrig direkte på `main`. Brug en `feature/*`-gren baseret på `develop`, medmindre opgaven udtrykkeligt fortsætter en eksisterende feature-gren.
4. Hold scope afgrænset. Spørg før en ændring, der ændrer eksisterende produktadfærd, introducerer en stor afhængighed eller modsiger dokumentationen.

## Implementeringsprincipper

- Bevar dansk UI-tekst og den eksisterende React/TypeScript/Material UI-struktur under `05_App/web`.
- Genbrug `CalendarEvent`, `CalendarService`, hooks og utils frem for at duplikere domæne- eller datokonverteringslogik.
- Bevar bagudkompatibilitet for enkeltstående aftaler uden `recurrence`.
- Gem kun lokale brugerdata gennem den etablerede `CalendarService` og `localStorage`-mekanisme, indtil et godkendt repository/synkroniseringslag erstatter den.
- Hold UI fri af fremtidige Google Calendar-kald. Integrationer skal ligge bag et service-/adapterlag.
- Ved gentagelser skal modellen følge RFC 5545-principper med eksplicit frekvens, interval og slutvilkår.

## Kvalitetssikring

Kør fra `05_App/web` efter relevante kodeændringer:

```powershell
npm run build
npm run lint
```

Tilføj og kør målrettede tests, når testinfrastruktur etableres eller når opgaven kræver det. Rapportér altid præcist, hvilke kontroller der er kørt, og deres resultat.

## Git og handover

- Brug små, fokuserede commits med beskrivende beskeder.
- Ingen commit, push, merge eller ændring af `main` uden udtrykkelig godkendelse.
- Opdatér relevant sprint-handover og dokumentation, når scope, beslutninger eller kendte begrænsninger ændres.
- Angiv ved aflevering: formål, ændrede/nye filer, test/build-resultater, kendte begrænsninger og anbefalet næste skridt.
