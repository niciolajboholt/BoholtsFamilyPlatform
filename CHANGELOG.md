# Changelog

## Sprint 52 — Mit i dag / Se som barn

- **Implementeret:** valgfri "Mit i dag"-side med medlemsvælger, næste
  aktivitet og dagens aftaler/opgaver oven på eksisterende data.
- **Hardening efter review 2026-09-19:** private aftaler redigeres til
  "Optaget" ud fra den faktiske seer, også når en anden profil vælges i
  forhåndsvisningen.
- **Hardening efter review 2026-09-19:** flerpersoners og fælles
  familieaftaler samt familie-rettede opgaver indgår nu i medlemmets
  overblik.
- **Hardening efter review 2026-09-19:** siden opdaterer automatisk
  afsluttede/næste aktiviteter og remounter datakilderne ved lokal midnat.
  Indlæsnings-, fejl- og ventende offline-status er synlig.
- **Verificering:** målrettede unit-tests og Playwright-scenarie er
  tilføjet, og siden indgår nu i de fælles a11y-, tastatur- og mobile
  breddetests.

## Sprint 50 — Fuld dataeksport og kontosletning

> Se `01_Project_Documentation/Development/50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md`
> for den fulde plan, de fire produktbeslutninger og deres svar.

- **Implementeret:** server-side dataeksport, `GET /api/families/:id/export`
  — ejeren får en fuld kopi af familiens data (inkl. andre medlemmers
  navn/e-mail), et almindeligt medlem kun sin egen konto plus egen
  kalender/opgaver. Krypterede felter (OAuth-tokens, iCloud-appkodeord) er
  aldrig med.
- **Implementeret:** to-trins konto-/familiesletning med
  gen-autentificering (`/auth/reauth/google` og `/auth/reauth/microsoft`,
  migration 0031) og 30 dages fortrydelsesperiode, før noget rent faktisk
  fjernes. En slettet brugers opgaver/udgifter bevares og vises som
  "Tidligere medlem"; en ejer kan i stedet vælge at slette hele familien
  (alt familiens data, permanent, efter fortrydelsesperioden). Purge kører
  på den eksisterende daglige Cron Trigger — ingen ny cron oprettet.
- **Implementeret:** UI i Indstillinger → Konto og data
  (`AccountDataSection.tsx`) til at downloade familiedata, anmode om
  kontosletning eller familiesletning, og fortryde en igangværende
  anmodning.
- **Verificeret manuelt i beta 2026-09-19:** en reel OAuth-
  gen-autentificerings-roundtrip, kontosletning/fortrydelse og
  dataeksport (kunne ikke afprøves fra udviklingsmiljøet, kun via
  automatiserede enheds-/rutetests — se plandokumentets "Manuelt
  opfølgningspunkt").
- **Hardening efter review 2026-09-19:** personlig kontosletning blokeres
  nu server-side, mens brugeren ejer en aktiv familie, så ejerskab først
  skal overdrages eller familien slettes særskilt. Dermed kan
  `families.owner_user_id` ikke efterlades pegende på en anonymiseret
  bruger uden aktiv ejerrolle.
- **Hardening efter review 2026-09-19:** ejereksporten inkluderer nu også
  rutinepunkter, skabelonvarer, kategori-tilpasninger,
  aftalepåmindelser, ugeresuméer og kalenderaktivitetslog. En eksplicit
  eksportpolitik klassificerer alle migrerede tabeller. Aktive
  delelinktokens, fulde hemmelige ICS-URL'er, invitationskoder, sync-
  tokens og krypterede credentials er udeladt; kun sikker metadata
  eksporteres for forbindelser.
- **Hardening efter review 2026-09-19:** sletning kræver nu både frisk
  OAuth-genautentificering og servervalideret destruktiv tekst
  (`SLET MIN KONTO` eller familiens eksakte navn). Reauth afviser også
  ugyldige og fremtidige timestamps.
- **Hardening efter review 2026-09-19:** `/api/health` kontrollerer nu
  `deletion_requests`, `users.deleted_at`, `families.deleted_at` og
  `sessions.reauthenticated_at`, så migration 0031 ikke fejlagtigt kan
  rapporteres som gennemført.

## Sprint 49 — Klargøring til Hjemmecentralen-lancering

> Se `01_Project_Documentation/Development/49_Sprint49_Hjemmecentralen_Launch_Prep_Plan.md`
> for den fulde verifikation og begrundelse bag disse ændringer.

- **Implementeret:** privatlivspolitik og vilkår (`LegalPage.tsx`) genskrevet,
  så de dækker Microsoft-login, den midlertidigt deaktiverede Outlook-
  kalenderintegration, iCloud CalDAV, ICS-abonnementer, opgavebelønning,
  fællesøkonomi, måltidsplaner, fødselsdage/gaver, push-abonnementer,
  lokale caches og offentlige delelinks — samt en præcis beskrivelse af,
  hvad den nuværende dataeksport faktisk indeholder (kun lokale data, ikke
  serverdata) og at kontosletning kræver en manuel anmodning.
- **Implementeret:** sikkerhedsheaders (CSP, `X-Content-Type-Options`,
  `Referrer-Policy`) tilføjet til den statiske appskal via
  `05_App/web/public/_headers` — hidtil satte Hono-middlewaren i
  `server/index.ts` kun disse headers på `/api/*` og `/auth/*`, mens `/`,
  `/privacy`, `/terms` og alle statiske filer blev serveret direkte af
  Cloudflares Assets-binding (`run_worker_first`) uden nogen headers.
- **Implementeret, mangler manuel verifikation:** en live `curl -I` mod
  beta-URL'en efter deploy, der bekræfter at `_headers`-filen faktisk
  anvendes af Cloudflare i produktion (kunne ikke verificeres fra
  udviklingsmiljøet, se plandokumentet).
- **Implementeret:** brugerrettet appnavn ændret fra "Boholts Familieapp"/
  "Boholts Family Platform" til **Hjemmecentralen** i sidetitel, login-side,
  PWA-manifest, fejlbeskeder, backup-filnavn og afsendernavn på
  admin-notifikations-e-mails. Tekniske ressourcenavne (Worker, D1,
  OAuth-klienter, repo, `localStorage`-nøglepræfiks) er bevidst uændrede.

## Sprint 48 — Login med Microsoft og forberedelse til Apple, ensrettede kalenderforbindelser (2026-09-13)

- Server-side Microsoft-login (authorization code + PKCE), migration 0030 —
  et familiemedlem uden Google-konto kan nu selv logge ind.
- Login-siden redesignet med tre knapper (Google/Microsoft/Apple) — Apple
  er bevidst kun visuel ("Kommer senere"), ingen OAuth-integration endnu.
- iCloud-kalenderforbindelser ensrettet med Google/Outlooks mønster
  (forbind konto → vælg kalendere, medlem-tilknytning sker separat).
- **Implementeret:** Del A (Microsoft-login) og login-siden er merget til
  `main` (PR #229–#233). **Ikke implementeret:** Apple-login (Del B).

## Sprint 47 — iCloud-kalender via CalDAV (2026-09-12–13)

- CalDAV-klient og -service til iCloud-kalendere: app-specifik
  adgangskode (krypteret server-side, samme metode som Google-tokens),
  kalendervalg pr. familiemedlem, samme UI-mønster som Google/Outlook.
- **Implementeret og merget til `main`** (PR #225/#226). Bemærk: plan-
  dokumentet `47_Sprint47_iCloud_Kalender_CalDAV_Plan.md` havde indtil
  denne opdatering stadig en forældet statuslinje, der sagde
  "Idé-/planlægningsstadie" — rettet i dette sprint.

## Sprint 38–43 — Måltidsplan, lommepenge, fødselsdage, fællesøkonomi, kiosk (2026-09-09)

- **Sprint 38 — Implementeret:** måltidsplanlægning med AI-genererede
  indkøbsforslag (migration 0023).
- **Sprint 39 — Implementeret:** opgavebelønning/lommepenge med
  saldo-overblik (migration 0024).
- **Sprint 40 — Implementeret:** fødselsdage og gaveplanlægning
  (migration 0025).
- **Sprint 41 — Implementeret:** fællesøkonomi (delte udgifter) mellem
  forældre (migration 0026).
- **Sprint 42 — Ikke implementeret:** danske skoleferier — kun research
  gennemført, ingen kode skrevet (commit `66767fa`: "research
  gennemført, ingen kode").
- **Sprint 43 — Implementeret:** kiosk-dashboard (`/kiosk`-ruten), en
  navigationsfri visning af dagens aftaler, opgaver og indkøbsliste.

## Sprint 44–46 — Google-produktion, omdøbningsforsøg, iOS-plan (2026-09-11)

- **Sprint 44 — Implementeret:** produktion (det unavngivne
  `wrangler.jsonc`-miljø) fik sin egen Google Cloud-klient, adskilt fra
  beta, forud for Googles OAuth-verificering.
- **Sprint 45 — Forsøgt, rullet tilbage:** et forsøg på at omdøbe
  Worker-ressourcen (kortere URL, væk fra "Boholt") blev rullet tilbage,
  fordi Cloudflare Workers Builds er bundet til den eksisterende
  Worker-ressource, ikke `wrangler.jsonc`s `name`-felt — se
  `wrangler.jsonc`s egen kommentar. En rigtig omdøbning kræver en ny
  Worker-ressource og er ude af scope for en kosmetisk ændring.
- **Sprint 46 — Planlagt, ikke påbegyndt:** en fremtidig native
  iOS-app via App Store — kun en plan, intet Xcode-projekt.

## Sprint 37 — Sikkerhed og kodekvalitet efter eksternt review

- `ADMIN_EMAIL` flyttet fra klartekst i `wrangler.jsonc` til Cloudflares
  Secrets Store, samme mønster som de øvrige fire secrets.
  `wrangler.example.jsonc` tilføjet som public-facing skabelon med
  placeholder-ressource-ID'er.
- ADR-018: formaliserer den allerede trufne Sprint 28-beslutning om, at
  `env.beta` er den reelle produktion, og det unavngivne miljø forbliver
  ubrugt.
- ADR-019: begrunder, hvorfor SameSite=Lax uden separat CSRF-token er
  tilstrækkeligt, efter en systematisk gennemgang af samtlige GET-ruter
  for utilsigtede tilstandsændringer.
- 14 patch/minor-afhængigheder opdateret efter en `npm outdated`-gennemgang
  (typescript/vite/eslint bekræftet reelt udgivne versioner, ikke
  fejlskrevne, som reviewet ellers mistænkte).
- `ShoppingListPage.tsx` (516 → 187 linjer) og `CalendarPage.tsx`
  (475 → 98 linjer) opdelt efter ansvar, samme mønster som Fase 6.
- Ny reel Playwright-E2E for Sprint 33's "Siden sidst du var her" — den
  eneste nyere funktion uden dækning ved en kort revision af testsuiten.

## Sprint 33 — "Siden sidst du var her"

- Nyt overblikskort på forsiden: et kompakt teaser-felt der ved tryk åbner
  et overblik over, hvad familien har lavet i appen siden brugerens
  sidste besøg — nye, flyttede og aflyste kalenderaftaler, fuldførte/nye
  opgaver, indkøb og nye familiemedlemmer, med "Vis alt" til den fulde,
  grupperede liste.
- Server-side kalender-aktivitetssynk (Google `syncToken`, samme mønster
  som Sprint 25's klient-cache) via det eksisterende 5-minutters
  cron-tick — ikke et live Google-opslag ved hvert besøg. Første synk og
  et udløbet syncToken er bevidst en bootstrap uden aktivitetsrækker, så
  ingen eksisterende aftaler fejlagtigt vises som "nye".
- Egen besøgs-cursor pr. bruger/familie (ikke sessions-baseret — en
  session lever 30 dage uden fornyelse og ville vise en for gammel
  "siden sidst").

## Sprint 28 — AI-ugeresumé

- Et kort, AI-genereret ugeresumé (kalenderaftaler, opgaver og
  indkøbsliste for den kommende uge) genereres ugentligt og sendes som en
  push-notifikation, samt vises på forsiden. Springer stille en familie
  over, hvis der intet er at opsummere.

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
