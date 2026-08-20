# Projektstatus

Senest opdateret: 2026-08-20

## Aktuel fase

Sprint 23-29 er gennemført og merget til `main`. Sprint 25 (kalender-sync)
og 26 (konfliktmarkering + delelink) er begge bekræftet virkende af Nicolaj
på beta/produktion. Sprint 27 (tidsbaserede påmindelser) og Sprint 28
(AI-ugeresumé) mangler hver deres manuelle funktionelle test af et rigtigt
cron-tick (kræver at vente på tiden, ikke en AI-agent-opgave) — selve koden
er leveret, testet og merget. Ingen aktiv sprint lige nu.

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
  fundet og rettet undervejs: `linked_user_id` blev aldrig sat noget sted i
  koden, så personligt tildelte opgaver aldrig kunne sende en push —
  "Min profil" i Indstillinger kobler nu kontoen til familiemedlemmet
  server-side.
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
- Vitest-testpakke (357 tests) + GitHub Actions-CI.

## Kvalitetsstatus

`develop` og `main` er ens t.o.m. Sprint 29:

- `npm run lint`
- `npm run build`
- `npm test` (357 tests)
- Grøn GitHub Actions-CI og Cloudflare Workers Build (produktion + beta)

Verificeret manuelt af Nicolaj og Christine på beta og produktion, inkl.
push-notifikation leveret på tværs af to iPhones, indkøbsliste-flowet
ende-til-ende, og opgave-/AI-modulet.

## Næste skridt

**Migration 0012 (family_weekly_summaries) og 0013
(family_share_links-tilvalg) er endnu ikke bekræftet kørt på beta/
produktion** — migrationer køres og verificeres altid manuelt af Nicolaj,
aldrig automatisk (se `09_Lessons_Learned.md`). Indtil 0012 er kørt kan
Sprint 28's ugentlige cron-job fejle på den manglende tabel; `/api/health`
(Sprint 29) viser nu migrations-status direkte og kan bruges til at
bekræfte det. Sprint 27's opgave-påmindelser og Sprint 28's ugeresumé
mangler desuden hver deres manuelle funktionelle test af et rigtigt
cron-tick (Nicolaj, tidsgated — ikke en AI-agent-opgave). Ellers ingen
aktiv sprint. Flere Google-konti pr. familie og en fysisk VoiceOver-test
forbliver ikke planlagt (se `10_Future_Roadmap.md`).
