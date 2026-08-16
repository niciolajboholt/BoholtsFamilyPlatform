# Project Status

Senest opdateret: 2026-08-16

## Aktuel fase

`main` er 1:1 med `develop` (Sprint 20-22 alle merget og deployet).
Ingen aktiv sprint lige nu.

## Gennemført

- Vision, produktstrategi, PRD, arkitektur, UX og roadmap.
- Platformskift fra SwiftUI til React/TypeScript/PWA (ADR-010).
- Sprint 0–19: kalendervisning, gentagne aftaler, familiemedlemmer,
  Google- og Outlook-kalenderintegration, PWA, automatiseret CI/test.
- **Sprint 20 (ADR-017)**: Cloudflare Worker + D1-backend, server-ejet
  Google-login, familier/medlemskab/invitationer, server-styret Google
  Calendar-sync (krypteret refresh token i D1), delt
  kalender-til-familiemedlem-tildeling, fjernelse af det lokale
  (ikke-Google) aftale-lag.
- **Sprint 21**: Web Push (VAPID)-fundament brugt af både kalender og
  indkøbsliste (notifikation ved ny/ændret/slettet aftale, og ved ny vare
  på indkøbslisten — afsenderen selv undtaget), samt en delt indkøbsliste
  pr. familie med selvlærende dansk kategori-ordbog. Bekræftet
  ende-til-ende, inkl. iOS Safari-push på tværs af familiemedlemmer.
- **Sprint 22**: flere navngivne indkøbslister med fast type
  (dagligvarer/byggemarked/andet), hver med sit eget kategorisæt og
  ordbog. Byggemarked-ordbog eksporteret til et Excel-ark, som Nicolaj og
  Christine selv kan rette/udvide og sende tilbage. Bekræftet virkende af
  Nicolaj efter afprøvning på produktion, inkl. efterfølgende tilføjede
  redigeringsmuligheder (omdøb liste, ret varenavn, skift kategori
  manuelt).
- **Driftsincident (2026-08-16)**: produktionsdatabasen manglede reelt
  hele familie-datamodellen (Sprint 20) og migration 0007 (Sprint 22),
  selvom begge var bekræftet kørt — kun beta havde dem korrekt. Fundet via
  en fuld skema-sammenligning mellem beta og produktion, rettet, og
  bekræftet identisk. Se lektionen i
  `01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`.

## Næste fase

Ingen aktiv sprint lige nu. Kandidater: flere Google-konti pr. familie
(kræver egen ADR), "Opgaver"-badget på forsiden (stadig "Snart").
