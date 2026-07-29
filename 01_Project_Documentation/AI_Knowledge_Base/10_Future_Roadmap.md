# 10_Future_Roadmap

> Status: Active

Version: 1.5

Project:
Boholts Family Platform

Last Updated:
2026-07-28 (Sprint 15-planlægning)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument samler den planlagte udviklingsretning fra `Product/07_Product_Roadmap.md` og `Development/19_Release_Plan.md`, så den er tilgængelig ét sted i Knowledge Base.

---

## Nuværende status

Fase 1 (Proof of Concept) er delvist gennemført: familieoverblik, kalendervisning, og opret/redigér/slet af aftaler findes. Google Calendar-integration er gennemført med både læse- og skriveadgang samt stille genoprettelse ved appstart (ud over hvad Fase 1 oprindeligt krævede). Sprint 13 tilføjede automatiseret test (Vitest) og formaliserede platformstrategien som ADR-10. Se [05_Sprint_History](05_Sprint_History.md).

Ikke inkluderet endnu, som forudsat i Release Plan: login, deling mellem brugere, push-notifikationer, widgets.

---

## Sprint 15 — Planlagt: Personlige farver pr. familiemedlem

**Status: Planned.**

**Baggrund**: En fuld farve-model pr. familiemedlem findes allerede i `calendarOwners.ts` (Nicolaj, Christine, Alfred, Jens, samt en delt "family"-farve), men bruges inkonsekvent:

- **Bug fundet**: `EventList.tsx` og `WeekCalendar.tsx` slår farve op via `getCalendarSourceColor(ownerId)` — en funktion beregnet til kalender*kilder* (local/google), ikke personer. Opslaget rammer aldrig rigtigt, så alle ejer-chips falder tilbage til standard-grå. `DayCell.tsx` og `EventParticipantsSection.tsx` gør det allerede korrekt (læser `calendarOwners[ownerId].color` direkte).
- **Duplikeret data**: `SettingsPage.tsx` har sit eget hardcodede `familyMembers`-array med de samme farver kopieret ind manuelt, i stedet for at læse fra `calendarOwners.ts`. Risiko for at de driver fra hinanden, hvis én rettes uden den anden.
- **Event-kort/bjælker** farves i dag efter kalender*kilde* (lokal vs. Google), ikke efter person — så selv efter bug-rettelsen vil selve begivenhedens farve stadig ikke afspejle, hvem den tilhører.

**Sprintindhold**:
1. Ret farveopslaget i `EventList.tsx` og `WeekCalendar.tsx` til at bruge `calendarOwners[ownerId].color` (samme mønster som `DayCell.tsx`).
2. Fjern det duplikerede `familyMembers`-array i `SettingsPage.tsx`; læs fra `calendarOwners.ts` i stedet, så der er ét sted at vedligeholde farverne.
3. Udvid event-kort/bjælker (`EventList`, `WeekCalendar`, `DayCell`) til at bruge ejerens farve, ikke kun kildens: én ejer → personens farve; "family" eller flere ejere → den delte family-farve (`#6D597A`), som allerede findes præcis til dette formål.
4. Ingen ny farve-vælger-UI denne sprint — fast palette, som i dag. Brugerdefinerede farver er et separat, senere scope, hvis det ønskes.

**Kritiske filer**: `calendarOwners.ts` (uændret, allerede korrekt), `EventList.tsx`, `WeekCalendar.tsx`, `DayCell.tsx`, `SettingsPage.tsx`.

---

## Fase 2 — MVP

- ~~Personlige farver pr. familiemedlem~~ — se Sprint 15 ovenfor.
- Familie-tidslinje.
- Konfliktvisning.
- Notifikationer.

---

## Fase 3 — Udvidelser

- Apple Calendar-integration.
- Outlook-integration.
- Widgets.
- Apple Watch.

---

## Fase 4 — Family OS

- Opgavestyring.
- Madplanlægning.
- Indkøbslister.
- AI-familieassistent.

---

## Versionsplan (jf. Release Plan)

- **v1.0**: Familieoversigt, kalender, Google Calendar, offline first, agenda-, uge- og månedvisning, opret/redigér/slet aftaler, familieprofiler.
- **v1.1**: Widgets, Apple Calendar, hurtige handlinger, flere kalenderfiltre.
- **v1.2**: Opgaver, indkøbsliste, påmindelser, gentagne aftaler.
- **v2.0**: Budget, madplan, dokumenter, ferieplanlægning, AI-assistent.

---

## Åbne strategiske spørgsmål

1. ~~**Platformstrategi**~~ — **Afklaret i Sprint 13**: formaliseret som ADR-010. Projektet er React/TypeScript/PWA, med Apple First som oplevelsesstrategi, ikke teknologikrav. Se [04_Project_History](04_Project_History.md) og `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`.
2. **Teststrategi** — **Delvist afklaret i Sprint 13**: Vitest indført, med regressionsdækning af de rene Google-mapper-funktioner. React-komponenter/hooks har fortsat ingen automatiseret test. Se [08_Development_Standards](08_Development_Standards.md).
3. ~~**Persistent Google-forbindelse**~~ — **Gennemført i Sprint 14**: en backend/refresh-token-løsning er bevidst fravalgt (omkostning/drift ikke proportional med 2-4 brugere). I stedet er stille genoprettelse ved appstart implementeret, med fald tilbage til det eksisterende "Genforbind"-flow. Se [05_Sprint_History](05_Sprint_History.md). Dette er en endelig arkitekturbeslutning, ikke kun udskudt.

---

## Dokumentets rolle

Dette dokument beskriver den planlagte, endnu ikke gennemførte udvikling. Når en fase eller version påbegyndes, flyttes den til [05_Sprint_History](05_Sprint_History.md) med faktisk status.
