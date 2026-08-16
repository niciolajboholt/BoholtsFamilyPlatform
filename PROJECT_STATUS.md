# Projektstatus

Senest opdateret: 2026-08-16

## Aktuel fase

Sprint 20 (multi-tenant familie-server, ADR-017) er merget til `main`
(produktion). Sprint 21 (push-notifikationer + delt indkøbsliste) er
gennemført og deployet.

## Leveret

- React/TypeScript/Vite/Cloudflare Workers + D1-webapp.
- Server-ejet Google-login (krypteret refresh token i D1, ADR-017) og
  Outlook-kalenderintegration (MSAL, klient-side).
- Familier: oprettelse, invitationer, medlemskab (ejer/admin/medlem).
- Måneds-, uge- og dagsvisning af kalenderaftaler — alle aftaler ejes af en
  ekstern kalender (Google/Outlook); intet lokalt aftale-lag.
- Kalender-til-familiemedlem-tildeling, delt på tværs af familiens devices
  (D1).
- Dynamiske familiemedlemmer og personlige farver.
- **Sprint 21**: Web Push (VAPID)-fundament, brugt af både kalender
  (ny/ændret/slettet aftale) og indkøbsliste (ny vare) — afsenderen selv
  undtaget. Delt indkøbsliste pr. familie med selvlærende dansk
  kategori-ordbog og "del som tekst"-funktion. Bekræftet ende-til-ende på
  tværs af familiemedlemmer, inkl. iOS Safari-push.
- Vitest-testpakke (213 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` består:

- `npm run lint`
- `npm run build`
- `npm test` (213 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones.

## Næste skridt

Ingen aktiv sprint. Kandidater: flere Google-konti pr. familie (kræver
egen ADR), "Opgaver"-badget på forsiden (stadig "Snart"), flere navngivne
indkøbslister i UI'et (API'et understøtter det allerede).
