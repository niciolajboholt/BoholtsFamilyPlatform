# Boholts Family Platform - Tasks

> Erstatter den oprindelige SwiftUI/SwiftData-plan (Sprint 1-3 nedenfor var
> aldrig udført) — platformen skiftede til React/TypeScript/PWA tidligt i
> projektet (ADR-010). Se `01_Project_Documentation/AI_Knowledge_Base/05_Sprint_History.md`
> for den fulde sprint-for-sprint-historik.

## Sprint 0 - Projektfundament

[x] Dokumentation oprettet
[x] Projektstruktur oprettet
[x] Git struktur oprettet

## Sprint 1-19 - React/TypeScript-webapp (PWA)

[x] Platformskift til React/TypeScript/PWA (ADR-010)
[x] Kalendervisning (måned/uge), opret/redigér/slet aftaler
[x] Gentagne aftaler (Apple Calendar-stil mønstre)
[x] Familiemedlemmer: navn, relation, farve, tilføj/slet
[x] Google Calendar: læse- og skriveadgang, stille genoprettelse
[x] Outlook Calendar-integration (MSAL)
[x] Automatiseret test (Vitest) + CI (GitHub Actions)
[x] PWA-konfiguration (manifest, service worker)

Se `05_Sprint_History.md` for detaljer pr. sprint.

## Sprint 20 - Multi-tenant familie-server (ADR-017)

[x] Fase 0: Cloudflare Worker + D1-fundament
[x] Fase 1: Server-ejet Google-login + session
[x] Fase 2: Familier, medlemskab, invitationer
[x] Fase 3: Server overtager Google Kalender-sync (krypteret refresh token i D1)
[x] Fase 4: Kalender-til-familiemedlem-tildeling → D1 (delt på tværs af devices)
[x] Fase 5: Lokalt (ikke-Google) aftale-lag fjernet — alle aftaler ejes af en ekstern kalender
[x] Fase 6: Oprydning i dødt kode, ajourført arkitektur-/datamodel-dokumentation
[x] Cloudflare Access fjernet fra Worker'en (manuel dashboard-handling, Nicolaj)
[x] Merget til `main` (produktion)

## Sprint 21 - Push-notifikationer + delt indkøbsliste

[x] Del A: Web Push (VAPID)-fundament — datamodel, abonnements-flow, service
    worker (push/notificationclick)
[x] Del A, fortsat: push-notifikation ved ny/ændret/slettet kalenderaftale
[x] Del B: delt indkøbsliste — datamodel, server-ruter, selvlærende dansk
    kategori-ordbog, UI
[x] Del B, fortsat: push-notifikation ved ny vare på indkøbslisten
[x] Manuel to-personers test på beta/produktion, inkl. iOS Safari-push
    (bekræftet: Nicolaj tilføjer vare → Christine modtager notifikation)
[x] Merget til `main` (PR #32, sammen med Sprint 22)

## Sprint 22 - Flere navngivne indkøbslister med type

[x] Migration 0007: type-felt på lister, list_type-skalerede overrides
[x] Server: type-bevidste kategorisæt/ordbøger (dagligvarer, byggemarked,
    andet), opdaterede ruter
[x] Klient: liste-vælger (faner) + "opret ny liste"-dialog med typevalg
[x] Manuel test på produktion (bekræftet af Nicolaj: "Det virker rigtig
    fint")
[x] Ekstra: redigering af listenavn, varenavn og manuel kategori-rettelse
[x] Byggemarked-ordbog eksporteret til Excel til fælles KS/udvidelse

## Sprint 23 - Opgaver (Tiimo-inspireret) + AI-modul

[x] Migration 0008: task_routines, task_routine_items, tasks
[x] Server: fuld CRUD for opgaver/rutiner, dovent materialiserede
    rutine-opgaver, push-notifikation ved oprettelse
[x] Klient: TasksPage ("Min dag"/"Familien", ikon-vælger,
    rutine-opret-dialog), koblet til forsiden
[x] AI-modul (Cloudflare Workers AI): rutine-forslag fra fritekst,
    ingrediens-forslag fra en ret til indkøbslisten — intet gemmes
    automatisk, altid en menneskelig godkendelse
[x] Manuel test på produktion (bekræftet af Nicolaj: "Det virker")

[x] Merget til `main` (PR #34)

## Sprint 24 - Drift-hygiejne

[x] README.md/CHANGELOG.md rettet til Worker+D1-arkitekturen
[x] Bekræftelse af `secrets_store_secrets`-navne i produktion (bekræftet
    identisk med koden, 2026-08-18)
[x] Cron Trigger til periodisk session- og rate-limit-oprydning
[x] Rate-limiting på invite-accept (D1-baseret, 10 forsøg/10 min pr. bruger)
[x] Migration 0009 kørt og verificeret på beta og produktion (2026-08-18)
[x] Dependabot aktiveret (npm + github-actions) — allerede leveret 11 PR'er
[x] Merget til `main` (PR #35, #44)

## Sprint 25 - Kalender-sync + PWA-ikoner

[x] nextSyncToken-inkrementel Google-synk (klient-cache + delta-flet)
[x] PNG-ikonsæt (192/512, maskable, apple-touch-icon)
[x] Manuel test på beta godkendt af Nicolaj (2026-08-20: "Alt i sprint
    25 er godkendt")
[x] Merget til `main` (PR #50)

## Sprint 26 - Kalender-konflikter + delelink

[x] Vedvarende visuel konfliktmarkering i alle fem kalendervisninger
[x] Migration 0010: family_share_links
[x] Server: share-link CRUD + offentligt /api/public/family-calendar/:token
[x] Klient: /share/:token-side + Delelink-sektion i Indstillinger
[x] Migration 0010 kørt og verificeret på beta og produktion (2026-08-18)
[x] Manuel test af delelinket bekræftet af Nicolaj (2026-08-19: "Dele
    linket virker") + opfølgende ændring til månedsvisning
[x] Manuel test af konfliktmarkeringen afdækkede en reel fejl
    (2026-08-20): "Familien"-aftaler blev aldrig markeret i konflikt med
    et specifikt medlems overlappende aftale (hasSharedOwner krævede
    eksakt id-match). Rettet (PR #71) og genbekræftet af Nicolaj samme
    dag: "jeg ser i hvert fald at der kommer en markering nu"
[x] Merget til `main` (PR #51, #52, #53, #71)

## Sprint 27 - Tidsbaserede opgave-påmindelser

[x] Migration 0011: tasks.reminded_at
[x] server/lib/taskReminders.ts: sendDueTaskReminders(), Cron Trigger
    hvert 5. minut, Europe/Copenhagen-tidszonelogik
[x] 7 nye tests, inkl. eksplicit CEST- og CET-test
[x] Migration 0011 kørt og verificeret på beta og produktion (2026-08-19)
[x] Manuelt tidspunkt-felt i UI (hurtig-tilføj + rutine-opgaver) —
    oversete i den oprindelige sprint-scope, tilføjet efter Nicolajs
    spørgsmål "Hvordan sætter jeg en påmindelse" (2026-08-19)
[x] Rodårsag fundet og rettet: `linked_user_id` blev aldrig sat noget
    sted i koden, så personligt tildelte opgaver aldrig kunne sende en
    push. "Min profil" i Indstillinger kobler nu reelt kontoen til
    familiemedlemmet server-side (nyt selvbetjenings-endpoint
    `POST /:id/members/:memberId/link-me`) (2026-08-19)
[x] Opgavens tidspunkt kan nu redigeres direkte på opgavelinjen efter
    oprettelse, ikke kun sættes ved oprettelsen (2026-08-19)
[x] Manuel funktionel test på beta bekræftet af Nicolaj (2026-08-20:
    "Push virker nu") — afdækkede endnu et lag af rodårsagen:
    `linkFamilyMemberToMe()` blev kun kaldt ved et *nyt* valg af "Min
    profil", så alle der havde valgt den før koblingen blev indført
    (Sprint 27) forblev ukoblet. `useCurrentMember` genkobler nu også
    ved almindelig app-indlæsning (PR #81)
[x] Merget til `main` (PR #55, #58, #60, #61, #81)

## Sprint 28 - AI-ugeresumé

[x] Migration 0012: family_weekly_summaries
[x] generateWeeklySummary() i aiAssistant.ts (fri tekst, ikke JSON) + 5 tests
[x] server/lib/weeklySummary.ts: sendWeeklySummaries(), Cron Trigger
    søndag kl. 17 UTC, springer tomme/allerede-genererede familier over
[x] 6 nye tests, inkl. manglende Google-forbindelse og materialisering af
    alle 7 dage
[x] GET /:id/weekly-summary + WeeklySummaryCard på forsiden (vises kun
    når et resumé findes)
[ ] Manuel funktionel test på beta (kræver at vente på et rigtigt
    ugentligt cron-tick, ikke en AI-agent-opgave)
[x] Produktionsmiljøets cron-triggers tømt (2026-08-19) — Cloudflares
    konto-brede 5-cron-loft (Free-plan) blev ramt af 2 miljøer × 3
    cron'er. Nicolaj bekræftede at produktion reelt ikke bruges (beta er
    familiens rigtige, daglige miljø/PWA), så produktion fik en tom
    `triggers.crons`-liste i stedet for en betalt Cloudflare-opgradering
[x] Merget til `main` (PR #63, #64)

## Sprint 29 - Sikkerhed, privatliv, drift

[x] Migration 0013: family_share_links.include_description/include_location
    (default kun titel/tidspunkt) + server/klient-tilvalg i ShareLinkCard
[x] Fuldstændig logout-oprydning: localStorage (clearAllFamilyStorage()),
    MSAL-cache (clearCache()), server-side push-afmelding
    (disablePushNotifications())
[x] /api/health udvidet med checkSchema() — migrations-synlighed uden en
    manuel "SELECT name FROM sqlite_master"-verifikation
[x] Misbrugsbegrænsning: rate-limit på AI-rutine-/ingrediensforslag,
    push-endpoint-validering (afviser localhost/private IP'er), to-lags
    rate-limit på delelinks (pr. besøgende+IP og pr. token)
[x] Seks mindre fejl: JSON-404 for ukendte /api/*-stier,
    sikkerhedsheaders (CSP m.fl.), notification-klik navigerer nu et
    allerede åbent vindue, bundnav viser intet valgt på Opgaver/
    Indkøbsliste (i stedet for fejlagtigt "Overblik"), "Ny aftale" på
    forsiden åbner nu opret-dialogen, global React Error Boundary
[x] Dokumentationssynkronisering: PROJECT_STATUS.md, README.md, issues
    #9/#20 gennemgået
[ ] Migration 0012 (family_weekly_summaries, Sprint 28) og 0013 (denne
    sprint) mangler at blive kørt og verificeret manuelt af Nicolaj på
    beta/produktion — /api/health viser nu status direkte
[x] Merget til `main` (PR #75-#79)

## Stabiliseringsrunde 2026-08-26

[x] Familieplanlægger: entydig fordeling af fælles/personlige aftaler og ingen kolliderende sticky-ugebånd
[x] Opgaveformularer og indstillingsrækker: labels og venstrejusteret skanning
[x] Loginbranding samt offentlige `/privacy`- og `/terms`-sider
[x] Migration 0017 + serverhåndhævet fravalg af automatisk AI-ugeresumé
[x] Cloudflare observability, genererede bindingstyper og versionsmetadata i health
[x] Tydelig offline-status uden at love offline-skrivning
[x] Playwright-smoke-tests for login/juridiske sider og alle hovedområder på desktop/mobil
[ ] Kør migration 0017 på beta og produktion (kræver Cloudflare-adgang)
[ ] Fuldfør Google OAuth-verifikation med de nye juridiske URL'er (kræver Google Cloud Console)

## Ikke planlagt endnu

[ ] Flere Google-konti pr. familie (kræver egen ADR — se `10_Future_Roadmap.md`)
[ ] Fysisk VoiceOver-test (kræver fysisk enhed, ikke en AI-agent-opgave)
