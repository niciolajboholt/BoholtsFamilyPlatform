# Project Status

Senest opdateret: 2026-08-19

## Aktuel fase

Sprint 23-27 er gennemført og merget til `main`. Sprint 25 (kalender-sync),
26's konfliktmarkering og 27 (tidsbaserede påmindelser) mangler hver deres
manuelle beta/produktions-test (kræver browser/tid, ikke en
AI-agent-opgave). Sprint 26's delelink er bekræftet virkende af Nicolaj.

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
- **Sprint 23**: Tiimo-inspireret opgaveløsning — engangsopgaver og faste
  rutiner (dovent materialiseret dag for dag, intet planlagt baggrundsjob),
  personlige eller familie-rettede, "Min dag"/"Familien"-visning. Et
  AI-modul via Cloudflare Workers AI (ikke en ekstern udbyder — data
  forlader ikke Cloudflares infrastruktur) foreslår rutiner ud fra fritekst
  og indkøbsliste-ingredienser ud fra en ret; intet gemmes automatisk uden
  et menneskes godkendelse. Bekræftet af Nicolaj på produktion.

- **Sprint 24**: drift-hygiejne efter et eksternt review — README/CHANGELOG
  ajourført til Worker+D1-arkitekturen, Cron Trigger til periodisk
  session-/rate-limit-oprydning, rate-limiting på invite-accept, Dependabot.
- **Sprint 25**: inkrementel Google-kalendersynk (`nextSyncToken`) via en ny,
  forkastelig lokal klient-cache af aftaler pr. Google-kalender (med
  fuld-synk-fallback ved udløbet token) samt et rigtigt PNG-ikonsæt til
  PWA'en (192/512, maskable, apple-touch-icon).
- **Sprint 26**: vedvarende visuel konfliktmarkering i alle
  kalendervisninger, og en read-only delelink til udvalgte
  familiemedlemmers kalendere for udenforstående uden login — appens
  første og eneste uautentificerede API-rute, rate-limitet pr. token.
  Delelinket viser en rigtig månedsvisning. Bekræftet virkende af Nicolaj
  på produktion.
- **Sprint 27**: tidsbaserede opgave-påmindelser — et sat tidspunkt sender
  nu en push-notifikation, når tiden kommer. Ny Cron Trigger hvert 5.
  minut, appens første server-side, tidszone-bevidste logik
  (`Europe/Copenhagen`).

## Næste fase

Sprint 25, 26 og 27's manuelle beta/produktions-test udestår (Nicolaj).
Migration 0011 skal desuden køres manuelt på beta/produktion. Ellers ingen
aktiv sprint. Kandidat: Sprint 28 (AI-ugeresumé) — se
`10_Future_Roadmap.md`. Flere Google-konti pr. familie forbliver ikke
planlagt (kræver egen ADR).
