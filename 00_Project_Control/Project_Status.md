# Project Status

Senest opdateret: 2026-08-16

## Aktuel fase

Sprint 20 er merget til `main` (produktion). Sprint 21
(push-notifikationer + delt indkøbsliste) er gennemført og deployet til
`develop`/produktion — se
`01_Project_Documentation/Development/21_Sprint21_Notifikationer_Indkoebsliste_Plan.md`.

## Gennemført

- Vision, produktstrategi, PRD, arkitektur, UX og roadmap.
- Platformskift fra SwiftUI til React/TypeScript/PWA (ADR-010).
- Sprint 0–19: kalendervisning, gentagne aftaler, familiemedlemmer,
  Google- og Outlook-kalenderintegration, PWA, automatiseret CI/test.
- **Sprint 20 (ADR-017)**: Cloudflare Worker + D1-backend, server-ejet
  Google-login, familier/medlemskab/invitationer, server-styret Google
  Calendar-sync (krypteret refresh token i D1), delt
  kalender-til-familiemedlem-tildeling, fjernelse af det lokale
  (ikke-Google) aftale-lag. Merget til `main`.
- **Sprint 21**: Web Push (VAPID)-fundament brugt af både kalender og
  indkøbsliste (notifikation ved ny/ændret/slettet aftale, og ved ny vare
  på indkøbslisten — afsenderen selv undtaget), samt en delt indkøbsliste
  pr. familie med selvlærende dansk kategori-ordbog
  (`shopping_item_category_overrides`) og "del som tekst". Bekræftet
  ende-til-ende, inkl. iOS Safari-push på tværs af familiemedlemmer.

## Næste fase

Ingen aktiv sprint lige nu. Kandidater: flere Google-konti pr. familie
(kræver egen ADR), "Opgaver"-badget på forsiden (stadig "Snart"), flere
navngivne indkøbslister i UI'et (API'et understøtter det allerede).
