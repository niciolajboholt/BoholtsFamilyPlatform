# Project Status

Senest opdateret: 2026-08-15

## Aktuel fase

Sprint 20 (multi-tenant familie-server, ADR-017) er funktionelt komplet på
`develop` og klar til at merges til `main`. Herefter er appen ikke længere
kun til Boholt-familien — enhver familie kan oprette sig selv og invitere
medlemmer.

## Gennemført

- Vision, produktstrategi, PRD, arkitektur, UX og roadmap.
- Platformskift fra SwiftUI til React/TypeScript/PWA (ADR-010).
- Sprint 0–19: kalendervisning, gentagne aftaler, familiemedlemmer,
  Google- og Outlook-kalenderintegration, PWA, automatiseret CI/test.
- **Sprint 20 (ADR-017), Fase 0-6**: Cloudflare Worker + D1-backend,
  server-ejet Google-login, familier/medlemskab/invitationer, server-styret
  Google Calendar-sync (krypteret refresh token i D1), delt
  kalender-til-familiemedlem-tildeling, fjernelse af det lokale
  (ikke-Google) aftale-lag, oprydning og ajourført dokumentation.

## I gang

- Nicolaj fjerner Cloudflare Access fra Worker'en (manuel dashboard-handling
  — appens eget login + invitationssystem er nu det primære adgangslag).

## Næste fase

Merge `develop` til `main` (produktion). Herefter: overvej flere
Google-konti pr. familie (kræver egen ADR), og de resterende "Snart"-badges
på forsiden (indkøbsliste, opgaver).
