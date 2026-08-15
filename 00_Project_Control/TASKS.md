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
[ ] Cloudflare Access fjernet fra Worker'en (manuel dashboard-handling, Nicolaj)

## Ikke planlagt endnu

[ ] Flere Google-konti pr. familie (kræver egen ADR — se `10_Future_Roadmap.md`)
[ ] Indkøbsliste, Opgaver (i dag "Snart"-badges på forsiden)
[ ] Fysisk iPhone/Safari/VoiceOver-test (kræver fysisk enhed, ikke en AI-agent-opgave)
