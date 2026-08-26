# Projektstatus

Senest opdateret: 2026-08-26

## Aktuel fase

Sprint 23-29 er gennemført og merget til `main`. En samlet stabiliseringsrunde
er implementeret på featurebranchen med kalender-UX, tilgængelighed,
AI-fravalg, juridiske sider, versionssporbarhed, offline-status og Playwright-
smoke-tests. Sprint 25 (kalender-sync),
26 (konfliktmarkering + delelink) og 27 (tidsbaserede påmindelser) er alle
bekræftet virkende af Nicolaj på beta. Sprint 27's bekræftelse afdækkede
endnu et lag af den samme rodårsag som tidligere: "Min profil"-koblingen
blev kun oprettet ved et *nyt* valg, ikke ved almindelig genindlæsning af
appen — rettet (PR #81), bekræftet virkende samme dag. Sprint 28
(AI-ugeresumé) mangler stadig sin manuelle funktionelle test af et rigtigt
ugentligt cron-tick. Ingen aktiv sprint lige nu.

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
  server-side, tidszone-bevidste logik (`Europe/Copenhagen`). Rodårsag
  fundet og rettet undervejs, i to lag: `linked_user_id` blev aldrig sat
  noget sted i koden ("Min profil" kobler nu kontoen til familiemedlemmet
  server-side), og selve koblingen skete kun ved et *nyt* valg, ikke ved
  almindelig genindlæsning — begge rettet og bekræftet virkende af
  Nicolaj på beta.
- **Sprint 28**: AI-genereret ugeresumé (Cloudflare Workers AI, fri tekst),
  sendt automatisk hver søndag kl. 17 via Cron Trigger, vist på forsiden når
  et resumé findes.
- **Sprint 29**: sikkerhed/privatliv/drift — delelinks viser som
  udgangspunkt kun titel/tidspunkt (beskrivelse/lokation er nu bevidste
  tilvalg), fuldstændig oprydning ved logout (localStorage, MSAL-cache,
  server-side push-afmelding), `/api/health` viser migrations-status,
  rate-limiting på AI-ruter/push-abonnement/delelinks, sikkerhedsheaders
  (CSP m.fl.), JSON-404 for ukendte API-stier, og en global React Error
  Boundary.
- Vitest-testpakke (397 tests) + Playwright-smoke-tests + GitHub Actions-CI.

## Kvalitetsstatus

Seneste validerede featurebranch bygger oven på `develop`:

- `npm run lint`
- `npm run build`
- `npm test` (397 tests)
- `npm run test:e2e` (desktop + mobil Chromium)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones, indkøbsliste-flowet
ende-til-ende, og opgave-/AI-modulet.

## Næste skridt

Migration 0012 og 0013 er kørt og verificeret på beta (2026-08-20, direkte
i D1-konsollen). Migration 0017 (AI-privatlivsvalg) skal køres på beta før
featurebranchen deployes og derefter på produktion før release. Sprint 28's ugeresumé mangler sin manuelle funktionelle
test af et rigtigt ugentligt cron-tick (Nicolaj, tidsgated — næste søndag).
Ellers ingen aktiv sprint. Flere Google-konti pr. familie og en fysisk
VoiceOver-test forbliver ikke planlagt (se `10_Future_Roadmap.md`).
