# Projektstatus

Senest opdateret: 2026-08-15

## Aktuel fase

Sprint 20 (multi-tenant familie-server, ADR-017) er funktionelt komplet på
`develop`, verificeret på beta, og klar til at merges til `main`.

## Leveret på `develop`

- React/TypeScript/Vite/Cloudflare Workers + D1-webapp.
- Server-ejet Google-login (krypteret refresh token i D1, ADR-017) og
  Outlook-kalenderintegration (MSAL, klient-side).
- Familier: oprettelse, invitationer, medlemskab (ejer/admin/medlem).
- Måneds-, uge- og dagsvisning af kalenderaftaler — alle aftaler ejes af en
  ekstern kalender (Google/Outlook); intet lokalt aftale-lag (fjernet Fase 5).
- Kalender-til-familiemedlem-tildeling, delt på tværs af familiens devices
  (D1, Fase 4).
- Dynamiske familiemedlemmer og personlige farver.
- Vitest-testpakke (180 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` består:

- `npm run lint`
- `npm run build`
- `npm test` (180 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta.

## Næste skridt

1. Merge den validerede `develop` til `main` (produktion).
2. Nicolaj fjerner Cloudflare Access fra Worker'en (manuel dashboard-handling).
3. Overvej flere Google-konti pr. familie (kræver egen ADR, ikke planlagt endnu).
