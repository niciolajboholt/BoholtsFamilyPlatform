# Projektstatus

Senest opdateret: 2026-08-19

## Aktuel fase

Sprint 23-27 er gennemført og merget til `main`. Sprint 25 (kalender-sync),
26's konfliktmarkering og 27 (tidsbaserede påmindelser) mangler hver deres
manuelle beta/produktions-test (kræver browser/tid, ikke en
AI-agent-opgave) — se
`01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md` for
Sprint 28. Sprint 26's delelink er bekræftet virkende af Nicolaj, inkl. en
opfølgende ændring til månedsvisning.

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
  undtaget. Bekræftet ende-til-ende på tværs af familiemedlemmer, inkl.
  iOS Safari-push.
- **Sprint 22**: flere navngivne indkøbslister med fast type
  (dagligvarer/byggemarked/andet), hver med eget kategorisæt/ordbog og
  selvlæring pr. familie og type. Redigering af listenavn, varenavn og
  manuel kategori-rettelse. Bekræftet af Nicolaj på produktion.
- **Sprint 23**: Tiimo-inspireret opgaveløsning (engangsopgaver og faste
  rutiner, personlige eller familie-rettede, "Min dag"/"Familien"-visning)
  samt et AI-modul via Cloudflare Workers AI (rutine-forslag fra fritekst,
  indkøbsliste-ingredienser fra en ret — intet gemmes automatisk). Data
  forlader ikke Cloudflares infrastruktur. Bekræftet af Nicolaj på
  produktion.
- **Sprint 24**: drift-hygiejne efter et eksternt review — README/CHANGELOG
  ajourført til Worker+D1-arkitekturen, Cron Trigger til periodisk
  session-/rate-limit-oprydning, rate-limiting på invite-accept, Dependabot.
- **Sprint 25**: `nextSyncToken`-inkrementel Google-kalendersynk (en ny,
  forkastelig lokal klient-cache af aftaler pr. Google-kalender, med
  fuld-synk-fallback ved udløbet token) samt et rigtigt PNG-ikonsæt til
  PWA'en (192/512, maskable, apple-touch-icon) i stedet for kun ét SVG-ikon.
- **Sprint 26**: vedvarende visuel konfliktmarkering i alle kalendervisninger
  (måned/uge/dag/side-by-side/dagsliste), og en read-only delelink til
  udvalgte familiemedlemmers kalendere for udenforstående (fx
  bedsteforældre) uden login — appens første og eneste uautentificerede
  API-rute, rate-limitet pr. token. Delelinket viser en rigtig
  månedsvisning (samme komponenter som resten af appen). Bekræftet
  virkende af Nicolaj på produktion.
- **Sprint 27**: tidsbaserede opgave-påmindelser — et sat tidspunkt på en
  opgave sender nu en push-notifikation, når tiden kommer (tidligere kun
  brugt til sortering). Ny Cron Trigger hvert 5. minut, appens første
  server-side, tidszone-bevidste logik (`Europe/Copenhagen`).
- Vitest-testpakke (309 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` og `main` er ens t.o.m. Sprint 27:

- `npm run lint`
- `npm run build`
- `npm test` (309 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones, indkøbsliste-flowet
ende-til-ende, og opgave-/AI-modulet.

## Næste skridt

Sprint 25's kalender-synk, Sprint 26's konfliktmarkering og Sprint 27's
påmindelser mangler hver deres manuelle beta/produktions-test (Nicolaj).
Migration 0011 skal desuden køres manuelt på beta/produktion. Ellers ingen
aktiv sprint. Kandidat: Sprint 28 (AI-ugeresumé) — se
`10_Future_Roadmap.md`. Flere Google-konti pr. familie forbliver ikke
planlagt (kræver egen ADR).
