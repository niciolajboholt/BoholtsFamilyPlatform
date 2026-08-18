# Projektstatus

Senest opdateret: 2026-08-18

## Aktuel fase

Sprint 23, 24 (drift-hygiejne) og 25 (kalender-sync + PWA-ikoner) er
gennemført. Sprint 25's manuelle beta/produktions-test udestår (kræver
browser, ikke en AI-agent-opgave) — se
`01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md` for
Sprint 26-28.

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
- Vitest-testpakke (272 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` og `main` er ens t.o.m. Sprint 24 (Sprint 25 afventer merge):

- `npm run lint`
- `npm run build`
- `npm test` (252 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones, indkøbsliste-flowet
ende-til-ende, og opgave-/AI-modulet.

## Næste skridt

Sprint 25's kode merges til `main`, når CI/Workers Builds er grønne.
Kandidater herefter: Sprint 26 (kalender-konflikter/delelink), 27
(tidsbaserede påmindelser), 28 (AI-ugeresumé) — se `10_Future_Roadmap.md`.
Flere Google-konti pr. familie forbliver ikke planlagt (kræver egen ADR).
