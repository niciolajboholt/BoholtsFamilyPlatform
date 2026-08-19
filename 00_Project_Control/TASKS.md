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
[ ] Manuel test på beta/produktion (kræver fysisk adgang/browser, ikke en
    AI-agent-opgave)
[x] Merget til `main` (PR #50)

## Sprint 26 - Kalender-konflikter + delelink

[x] Vedvarende visuel konfliktmarkering i alle fem kalendervisninger
[x] Migration 0010: family_share_links
[x] Server: share-link CRUD + offentligt /api/public/family-calendar/:token
[x] Klient: /share/:token-side + Delelink-sektion i Indstillinger
[x] Migration 0010 kørt og verificeret på beta og produktion (2026-08-18)
[x] Manuel test af delelinket bekræftet af Nicolaj (2026-08-19: "Dele
    linket virker") + opfølgende ændring til månedsvisning
[ ] Manuel test af konfliktmarkeringen på beta/produktion udestår
[x] Merget til `main` (PR #51, #52, #53)

## Sprint 27 - Tidsbaserede opgave-påmindelser

[x] Migration 0011: tasks.reminded_at
[x] server/lib/taskReminders.ts: sendDueTaskReminders(), Cron Trigger
    hvert 5. minut, Europe/Copenhagen-tidszonelogik
[x] 7 nye tests, inkl. eksplicit CEST- og CET-test
[x] Migration 0011 kørt og verificeret på beta og produktion (2026-08-19)
[ ] Manuel funktionel test på beta/produktion (kræver at vente på et
    rigtigt cron-tick, ikke en AI-agent-opgave)
[x] Merget til `main` (PR #55)

## Ikke planlagt endnu

[ ] Flere Google-konti pr. familie (kræver egen ADR — se `10_Future_Roadmap.md`)
[ ] Fysisk VoiceOver-test (kræver fysisk enhed, ikke en AI-agent-opgave)
