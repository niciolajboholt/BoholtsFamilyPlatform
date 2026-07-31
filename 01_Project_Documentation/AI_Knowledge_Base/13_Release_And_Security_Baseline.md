# 13_Release_And_Security_Baseline

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-07-30

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument samler det minimumsgrundlag for release og sikkerhed, som en lille familieapp med rigtige familie- og kalenderdata samt Google OAuth bør have (Audit F-08). Det erstatter ikke en fuld enterprise-sikkerhedspolitik — det er bevidst afgrænset til projektets faktiske størrelse og risikoprofil (single-device, én familie, ingen backend).

---

## Release-checkliste

Før en `develop` → `main`-merge eller anden release:

1. `npm run lint` — grøn.
2. `npm run build` — grøn.
3. `npm test` — grøn (kører automatisk i CI, se `.github/workflows/ci.yml`).
4. Manuel smoke-test i browser: opret/redigér/slet en lokal aftale, tjek "Vis kalendere", og hvis Google er konfigureret, tjek forbindelse/synkronisering.
5. Gennemgå diff'en for utilsigtet committede hemmeligheder (`.env.local`, tokens) — `.gitignore` udelukker allerede `.env*` (undtagen `.env.example`).

## Miljøvariabler og Google-konfiguration

Dokumenteret i `05_App/web/.env.example` og rod-`README.md`. Kort opsummeret:

- `VITE_GOOGLE_CALENDAR_ENABLED` — slår Google-integrationen til/fra.
- `VITE_GOOGLE_CLIENT_ID` — et OAuth Web Client ID fra Google Cloud Console. Ikke en hemmelighed i klassisk forstand (det er offentligt synligt i klientkoden), men skal stadig kun oprettes af projektejeren i eget Google Cloud-projekt.

Der er ingen server-side hemmeligheder (client secret, API-nøgler) i dette projekt, fordi der ikke er nogen backend — se ADR-011 (single-device).

## Token-livscyklus og storage-begrænsninger

- Google OAuth-adgangstokenet opbevares **udelukkende i hukommelsen** (`GoogleCalendarSession`), aldrig i `localStorage` eller cookies.
- Et sideindlæsning/reload kræver en ny forbindelse (evt. stille genoprettet, se Sprint 14) — der er ingen refresh token og ingen vedvarende session.
- Service workerens cache (F-04) er eksplicit konfigureret til `NetworkOnly` for alle kald til `googleapis.com`/`accounts.google.com`, så der aldrig ligger en cached kopi af kalenderdata eller et token i offline-cachen.

## Afhængigheder og sårbarhedskontrol

- `npm ci` bruges konsekvent (i CI og lokalt), så installationen matcher `package-lock.json` nøjagtigt.
- Anbefalet praksis: kør `npm audit` periodisk (fx ved større afhængighedsopdateringer) og ved reelle sikkerhedsadvarsler fra GitHub (Dependabot-alerts, hvis aktiveret på repoet).
- Der er ingen automatisk `npm audit`-gate i CI endnu — det er en bevidst, lav-risiko fravalg for et lille, ikke-offentligt projekt, men kan tilføjes som et ekstra CI-trin, hvis det ønskes senere.

## Backup, restore og datatab

Se ADR-012 og den implementerede eksport/import-funktion i Indstillinger (`dataBackupStorage.ts`, Audit F-11). Al lokal data (`localStorage`) kan eksporteres til en JSON-fil og genindlæses. Dette er brugerens eget ansvar at gøre jævnligt — der er ingen automatisk, skjult backup, og ingen central server, der gemmer en kopi.

**Risiko, eksplicit accepteret**: rydder brugeren browserens data (eller skifter enhed) uden forudgående eksport, er de lokale data tabt. Google Calendar-data er upåvirket, da det ejes af Google, ikke af denne app.

## Releaseansvar og rollback

- Der er ingen automatiseret deployment-pipeline — releases sker ved at merge en valideret `develop` til `main` (se F-01), som beskrevet i `README.md`s "Repository-strategi".
- Rollback er en almindelig Git-operation: revert af merge-commit'en på `main`, eller checkout af en tidligere tag/commit. Der findes ingen database-migrationer at rulle tilbage (single-device, `localStorage`).
- Nicolaj er projektejer og eneste beslutningstager om, hvornår en `develop`-tilstand er klar til `main` — AI-agenter committer/pusher til feature-branches, men merger kun efter eksplicit test og godkendelse (se `06_Claude_Playbook.md`).

---

## Relaterede dokumenter

* `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` (ADR-011, ADR-012)
* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`
* `05_App/web/.env.example`
* `.github/workflows/ci.yml`
