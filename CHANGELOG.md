# Changelog

## Sprint 27 — Tidsbaserede opgave-påmindelser

- Et sat tidspunkt på en opgave sender nu en push-notifikation, når tiden
  kommer, i stedet for kun at blive brugt til sortering.
- Efterfølgende rettelser (2026-08-19): manuelt tidspunkt-felt tilføjet i
  UI'et (hurtig-tilføj + rutine-opgaver, som var overset i den
  oprindelige sprint-scope); "Min profil" i Indstillinger kobler nu reelt
  brugerens konto til familiemedlemmet server-side (linked_user_id var
  aldrig blevet sat nogen steder i koden, så personligt tildelte
  opgave-notifikationer aldrig kunne leveres); opgavens tidspunkt kan nu
  redigeres direkte på opgavelinjen efter oprettelse.

## Sprint 26 — Kalender-konflikter + delelink

- Vedvarende visuel markering af overlappende aftaler direkte i
  kalendervisningen (måned/uge/dag/side-by-side/dagsliste) — tidligere
  fandtes konfliktdetektion kun midlertidigt i opret/redigér-dialogen.
- Read-only delelink til udvalgte familiemedlemmers kalendere, til
  udenforstående (fx bedsteforældre) uden login, med en rigtig
  månedsvisning. Kan til enhver tid deaktiveres/regenereres fra
  Indstillinger.

## Sprint 25 — Kalender-sync + PWA-ikoner

- Inkrementel Google Calendar-synk (`nextSyncToken`): en gentaget
  opdatering henter kun ændrede/slettede aftaler siden sidst i stedet for
  hele tidsvinduet på ny, via en ny, forkastelig lokal klient-cache pr.
  Google-kalender. Falder automatisk tilbage til en fuld synk, hvis intet
  er cachet endnu, eller Google afviser et udløbet syncToken.
- Rigtigt PNG-ikonsæt til PWA'en (192×192, 512×512, maskable-varianter,
  apple-touch-icon) i stedet for kun ét SVG-ikon overalt.

## Sprint 24 — Drift-hygiejne

- README.md/CHANGELOG.md ajourført til den faktiske Worker+D1-arkitektur.
- Cron Trigger til periodisk oprydning af udløbne sessioner og gamle
  rate-limit-forsøg.
- Rate-limiting på invite-accept-endpointet.
- Dependabot aktiveret.

## Sprint 23 — Opgaver (Tiimo-inspireret) + AI-modul

- Tiimo-inspireret opgaveløsning: engangsopgaver og faste rutiner, dovent
  materialiseret dag for dag (ingen Cloudflare Cron Trigger nødvendig),
  personlige eller familie-rettede, "Min dag"/"Familien"-visning.
- AI-modul via Cloudflare Workers AI: rutine-forslag fra fritekst,
  indkøbsliste-ingredienser fra en ret — altid som et udkast, intet gemmes
  automatisk uden en menneskelig godkendelse.

## Sprint 22 — Flere navngivne indkøbslister med type

- Flere navngivne indkøbslister med fast type (dagligvarer/byggemarked/
  andet), hver med eget kategorisæt/ordbog og selvlæring pr. familie og
  type.
- Redigering af listenavn, varenavn og manuel kategori-rettelse.
- Byggemarked-ordbogen eksporteret til Excel til fælles KS/udvidelse.

## Sprint 21 — Push-notifikationer + delt indkøbsliste

- Web Push (VAPID)-fundament, brugt af både kalender (ny/ændret/slettet
  aftale) og en ny, delt indkøbsliste pr. familie (ny vare) — afsenderen
  selv undtaget.
- Selvlærende dansk kategori-ordbog til indkøbslisten.
- Bekræftet ende-til-ende på tværs af familiemedlemmer, inkl. iOS
  Safari-push.

## Sprint 20 — Multi-tenant familie-server (ADR-017)

- Ny Cloudflare Worker + D1-backend, der erstatter den klient-only PWA.
- Server-ejet Google-login (krypteret refresh token i D1) og
  server-styret Google Calendar-sync.
- Familier: oprettelse, invitationer, medlemskab (ejer/admin/medlem).
- Kalender-til-familiemedlem-tildeling delt på tværs af familiens devices
  (D1) i stedet for kun lokalt.
- Det lokale (ikke-Google) aftale-lag fjernet — alle aftaler ejes af en
  ekstern kalender.

## Version 1.1

- Ny dagsvisning (time-for-time-tidslinje) og "Side by side"-familieplanlægger
  (medlemmer som kolonner, uendelig scroll gennem uger/måneder).
- Ugevisningens redundante agenda-liste fjernet.
- Første-opstart-onboarding med generiske standardnavne (ADR-015).
- Outlook Kalender-integration bygget (ADR-016) — midlertidigt deaktiveret,
  afventer IT-godkendelse hos arbejdsgiveren.
- Diverse rettelser: planlæggerens klæbende header og gitterlinjer.

## Version 0.1

- Projektstruktur oprettet.
- Dokumentationsgrundlag etableret.
