# 14_Requirements_Traceability

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

En letvægts-sporbarhedsmatrix mellem den eksterne audits fund (F-01 til F-17), deres GitHub-issues, koden der løser dem, testdækningen og den nuværende status (Audit F-15). Formatet er bevidst holdt til projektets størrelse — én tabel, opdateret ved sprintafslutning, ikke et separat værktøj.

**Konvention fremadrettet**: commits og PR'er, der adresserer et fund, bør referere det i beskeden (fx "Fixes F-05" eller "Audit F-12"), så `git log`/PR-historik selv er en del af sporbarheden.

---

## Matrix

| Fund | Beskrivelse | Issue | Kodeområde | Test | Status |
|---|---|---|---|---|---|
| F-01 | `main` er ikke en releasable standardbranch | [#5](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/5) | Merge af `develop` → `main` | CI (lint/build/test) på begge branches | Løst (2026-07-30) |
| F-02 | Ubrugte Sprint 16-imports fejler lint/build | [#6](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/6) | `CalendarPage.tsx` | `npm run lint`/`build` | Løst (2026-07-29) |
| F-03 | Kalenderlås i React Strict Mode | [#7](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/7) | `useCalendarSources.ts`, `useCalendarEvents.ts`, `NewEventDialog.tsx` | `useCalendarLoading.test.tsx` | Løst (2026-07-29) |
| F-04 | PWA/offline kun installeret, ikke konfigureret | [#8](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/8) | `vite.config.ts`, `index.html` | Manuel: produktions-preview + service worker-registrering verificeret | Løst (2026-07-30) |
| F-05 | Google-hentning bruger ugyldige RFC3339-år, ineffektiv | [#9](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/9) | `calendarProvider.ts`, `useCalendarEvents.ts`, `LocalCalendarProvider.ts` | `calendarProvider.test.ts`, `LocalCalendarProvider.test.ts` | Delvist løst (2026-07-30) — bundet vindue løst; `nextSyncToken`/delt cache fortsat åbent |
| F-06 | Ingen dokumenteret single source of truth | [#10](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/10) | ADR-012 (dokumentation, ingen kodeændring) | — | Løst (2026-07-30) |
| F-07 | Ingen CI | [#11](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/11) | `.github/workflows/ci.yml` | CI kører sig selv | Løst (2026-07-29) |
| F-08 | Manglende release-/sikkerhedsgrundlag | [#12](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/12) | `13_Release_And_Security_Baseline.md` (dokumentation) | — | Løst (2026-07-30) |
| F-09 | Uafklaret single-device-begrænsning | [#13](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/13) | ADR-011 (dokumentation) | — | Løst (2026-07-30) — bevidst single-device |
| F-10 | Dashboardets mockfunktioner | [#14](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/14) | `HomePage.tsx` | Manuel: verificeret med rigtig aftale i browser | Løst (2026-07-30) |
| F-11 | Ingen data-versionering/migration/backup | [#15](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/15) | `dataBackupStorage.ts`, ADR-012 | `dataBackupStorage.test.ts` | Løst (2026-07-30) |
| F-12 | `reassignOwner` omskriver ikke `sourceId` | [#16](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/16) | `CalendarService.ts` | `CalendarService.test.ts` | Løst (2026-07-29) |
| F-13 | Ufærdig recurrence | [#17](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/17) | `expandRecurringEvents.ts` | `expandRecurringEvents.test.ts` | Løst (2026-07-29) |
| F-14 | Forældet README/projektstatus | [#18](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/18) | `README.md`, `10_Future_Roadmap.md` | — | Løst (2026-07-30) |
| F-15 | Manglende kravsporbarhed | [#19](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/19) | Dette dokument | — | Løst (2026-07-30) |
| F-16 | Forkert sprogmetadata, delvis a11y/UX | [#20](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/20) | `index.html` (`lang`, titel) | — | Delvist løst (2026-07-29) — a11y/fysisk enhedstest kræver Nicolaj |
| F-17 | UTF-8-encodingfejl | [#21](https://github.com/niciolajboholt/BoholtsFamilyPlatform/issues/21) | `GoogleCalendarApi.ts`, `GoogleCalendarSession.ts` | — | Løst (2026-07-29) |

---

## Åbne krav uden for denne matrix' løsningsomfang

Nogle punkter i F-05 og F-16 er bevidst kun delvist løst — de resterende dele kræver enten en større arkitekturbeslutning (F-05: `nextSyncToken`/inkrementel sync) eller fysisk enhedsadgang, som en AI-agent ikke kan udføre alene (F-16: iPhone/Safari/VoiceOver-test). Disse forbliver åbne i GitHub Issues #9 og #20 med kommentarer, der beskriver præcis hvad der mangler.

---

## Relaterede dokumenter

* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`
* `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`
