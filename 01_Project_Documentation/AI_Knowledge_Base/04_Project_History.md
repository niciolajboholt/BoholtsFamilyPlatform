# 04_Project_History

> Status: Active

Version: 1.1

Project:
Boholts Family Platform

Last Updated:
2026-07-28

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument beskriver projektets historik fra idé til nuværende status, så nye deltagere — menneskelige eller AI — hurtigt kan forstå, hvordan projektet er nået hertil.

---

## Oprindelig retning: Apple First

Projektet blev oprindeligt defineret med en Apple-first strategi (ADR-006, 2026-07-24): native udvikling i Swift, SwiftUI, SwiftData og Xcode, målrettet iPhone og iPad med mulighed for macOS senere. Vision og produktprincipper (Vision/01, Product/02) og en række udviklingsdokumenter (Xcode-opsætning, SwiftData-datamodel, POC-sprintplan) blev udarbejdet på dette grundlag.

---

## Retningsskifte til React/TypeScript

Den faktiske implementering, der blev påbegyndt 2026-07-26, er en **React 19 + TypeScript webapp** (Vite, Material UI, React Router, PWA), ikke en native Swift-app.

Årsagen er praktisk: udviklingsmaskinen var en ældre Mac uden adgang til en tilstrækkeligt opdateret version af Xcode til at understøtte moderne SwiftUI/SwiftData-udvikling. React, TypeScript og PWA blev derfor valgt som et fælles teknologisk fundament, der kunne udvikles fra den tilgængelige maskine (herunder Windows), samtidig med at Apple-first forblev en **oplevelsesstrategi** frem for en teknologisk begrænsning — se [12_Project_DNA](12_Project_DNA.md).

Dette skifte er ikke dokumenteret som en formel ADR-beslutning, og de oprindelige Apple-first-dokumenter er ikke opdateret til at afspejle det. Der er dermed en kendt uoverensstemmelse mellem den strategiske dokumentation (Swift/SwiftUI) og den faktiske kodebase (React/TypeScript), som bør formaliseres som en ADR (se [10_Future_Roadmap](10_Future_Roadmap.md) og [09_Lessons_Learned](09_Lessons_Learned.md)).

---

## Udviklingsforløb (2026-07-26 til 2026-07-28)

Hele det hidtidige udviklingsforløb er sket over tre dage:

- **2026-07-26** — Projektet initialiseres: React/TypeScript-app, routing, PWA-fundament, app-skal og navigation.
- **2026-07-27** — Dashboard og familie-designsystem. Kalenderfundamentet bygges: event-model, dato-/ugefiltrering, ejerskab pr. familiemedlem, måneds- og ugevisning, lokal persistence via `CalendarService`. Sprint 3 (kalenderfundament) afsluttes samme dag. Event-redigering, sletning og et gentagelsesmodel (recurrence) tilføjes.
- **2026-07-28** — Omfattende refaktorering af dialog-koden (Sprint 8): formular-state, validering, konflikthåndtering og UI-sektioner udskilles i selvstændige hooks/komponenter. Herefter indføres calendar-provider-arkitekturen (ADR-007), kalenderkilde-synlighed og -farver centraliseres, og Google Calendar integreres — først skrivebeskyttet (ADR-008, Sprint 11.1), derefter med skriveadgang (ADR-009, Sprint 12.1).

Se [05_Sprint_History](05_Sprint_History.md) for en sprint-for-sprint gennemgang.

---

## Nøglebeslutninger undervejs

- **ADR-007**: Indførelse af `CalendarProvider`-abstraktion, så UI aldrig bindes direkte til en specifik kalenderkilde.
- **ADR-008**: Google Calendar tilføjes som valgfri, skrivebeskyttet kilde via `CompositeCalendarProvider`, med namespacede kilde-/event-id'er og token kun i hukommelsen.
- **ADR-009**: Skriveadgang til Google Calendar tilføjes med mindst mulige rettigheder (`calendar.events`, `calendar.calendarlist.readonly`), routet via `sourceId`. Ingen backend, refresh token eller persistent forbindelse endnu.

---

## Team- og arbejdsproces-historik

Projektet startede med en tredelt AI-model: Nicolaj (Product Owner), ChatGPT (Solution Architect & Tech Lead) og Codex (Software Engineer). Fra 2026-07-28 er denne model konsolideret, så Claude dækker begge AI-roller. Se [02_AI_Team_and_Roles](02_AI_Team_and_Roles.md) for den fulde beskrivelse og [06_Claude_Playbook](06_Claude_Playbook.md) for arbejdsmåden.

---

## Dokumentation

Projektets dokumentation blev i juli 2026 omstruktureret: de tidligere rod-niveau-filer i `01_Project_Documentation` (00–12) blev flyttet ind i denne `AI_Knowledge_Base`-mappe. Nogle filer blev tilføjet direkte via GitHub ("Add files via upload") frem for lokale commits, hvilket bør være opmærksomhedspunkt ved fremtidig oprydning.

---

## Dokumentets rolle

Dette dokument beskriver projektets historiske forløb. Detaljeret sprint-for-sprint-status findes i [05_Sprint_History](05_Sprint_History.md), og arkitekturbeslutninger er fuldt dokumenteret i projektets ADR'er.
