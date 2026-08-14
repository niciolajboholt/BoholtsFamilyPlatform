# Project Status

Senest opdateret: 2026-08-13

## Aktuel fase

Version 1.1 (Sprint 0–19) af React/TypeScript-webappen er released til
`main`. Sprint 20 (multi-tenant familie-server, ADR-017) er i gang på
separate `feature/sprint-20-fase*`-branches — se "I gang / næste skridt".

## Gennemført

- Vision, produktstrategi, PRD, arkitektur, UX og roadmap.
- Platformskift fra SwiftUI til React/TypeScript/PWA (ADR-010).
- Sprint 0–19 på `main` (se `01_Project_Documentation/AI_Knowledge_Base/05_Sprint_History.md`).
- Lokale kalenderflows, gentagne aftaler, og Google Calendar
  læse-/skriveintegration.
- Førstegangs-onboarding med generiske standardnavne (ADR-015).
- Outlook Calendar-integration bygget (ADR-016) — deaktiveret i kode,
  afventer IT-godkendelse hos Nicolajs arbejdsgiver.
- Dags- og "side-by-side" familieplanlægger-visning (Sprint 19).
- Automatiserede enhedstests (Vitest) og GitHub Actions-CI.

## I gang / næste skridt

- **Sprint 20 (ADR-017)** — Cloudflare Worker + D1-server, så appen kan
  deles mellem flere devices/familier (fx Christine):
  - Fase 0–1 (server-fundament, Google-login): færdige, merget til `develop`.
  - Fase 2 (familier/invitationer): bygget, afventer Christines test af
    invitationsflowet + Nicolajs godkendelse før merge til `develop`.
  - Fase 3 (server-ejet Google-sync): bygget, mangler rigtig beta-test og
    godkendelse (en PR mod `main` blev lukket uden merge 2026-08-10).
  - Fase 4 (kalender-medlem-mapping til delt database): første commit
    2026-08-12.
  - Fase 5 (udfas lokale aftaler) og Fase 6 (oprydning + Cloudflare
    Access-beslutning på `main`): ikke startet.
- IT-godkendelse af Outlook-integrationen, så den kan slås til i produktion.
- Fortsat åbent fra stabiliseringen: komponent-/hook-tests i Strict Mode,
  Playwright-flows, og fysisk iPhone/Safari/VoiceOver-test (kræver Nicolajs
  egen enhed).
