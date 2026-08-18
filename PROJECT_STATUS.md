# Projektstatus

Senest opdateret: 2026-08-16

## Aktuel fase

Sprint 23 er gennemført og deployet til `develop`. `main` indeholder
t.o.m. Sprint 22 — Sprint 23 er endnu ikke merget dertil. Ingen aktiv
sprint lige nu.

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
- Vitest-testpakke (252 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` består (Sprint 23 endnu ikke merget til `main`):

- `npm run lint`
- `npm run build`
- `npm test` (252 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones, indkøbsliste-flowet
ende-til-ende, og opgave-/AI-modulet.

## Næste skridt

Ingen aktiv sprint. Kandidater: flere Google-konti pr. familie (kræver
egen ADR), merge Sprint 23 til `main`.
