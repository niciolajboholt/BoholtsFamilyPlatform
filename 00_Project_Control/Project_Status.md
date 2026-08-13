# Project Status

Senest opdateret: 2026-08-13

## Aktuel fase

Version 1.1 af React/TypeScript-webappen er released til `main`.
Stabiliseringsmilepælen efter den eksterne audit (2026-07-29) blev afsluttet
2026-07-30, og featureudvikling er genoptaget siden.

## Gennemført

- Vision, produktstrategi, PRD, arkitektur, UX og roadmap.
- Platformskift fra SwiftUI til React/TypeScript/PWA (ADR-010).
- Sprint 0–18 på `main` (se `01_Project_Documentation/AI_Knowledge_Base/05_Sprint_History.md`).
- Lokale kalenderflows, gentagne aftaler, og Google Calendar
  læse-/skriveintegration.
- Førstegangs-onboarding med generiske standardnavne (ADR-015).
- Outlook Calendar-integration bygget (ADR-016) — deaktiveret i kode,
  afventer IT-godkendelse hos Nicolajs arbejdsgiver.
- Dags- og "side-by-side" familieplanlægger-visning.
- Automatiserede enhedstests (Vitest) og GitHub Actions-CI.

## I gang / næste skridt

- IT-godkendelse af Outlook-integrationen, så den kan slås til i produktion.
- Beslutning om og planlægning af næste sprint — kandidater i roadmap'en er
  "flere Google-konti pr. familie" (endnu ikke planlagt, kræver egen ADR) og
  Fase 2-punkterne (familie-tidslinje, konfliktvisning, notifikationer).
- Fortsat åbent fra stabiliseringen: komponent-/hook-tests i Strict Mode,
  Playwright-flows, og fysisk iPhone/Safari/VoiceOver-test (kræver Nicolajs
  egen enhed).
