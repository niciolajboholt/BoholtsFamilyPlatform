# 10_Future_Roadmap

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

Dette dokument samler den planlagte udviklingsretning fra `Product/07_Product_Roadmap.md` og `Development/19_Release_Plan.md`, så den er tilgængelig ét sted i Knowledge Base.

---

## Nuværende status

Fase 1 (Proof of Concept) er delvist gennemført: familieoverblik, kalendervisning, og opret/redigér/slet af aftaler findes. Google Calendar-integration er gennemført med både læse- og skriveadgang (ud over hvad Fase 1 oprindeligt krævede). Se [05_Sprint_History](05_Sprint_History.md).

Ikke inkluderet endnu, som forudsat i Release Plan: login, deling mellem brugere, push-notifikationer, widgets.

---

## Fase 2 — MVP

- Personlige farver pr. familiemedlem.
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

Disse bør afklares, før roadmappen føres videre i praksis:

1. **Platformstrategi**: Skal projektet formelt skifte fra Apple-first (Swift/SwiftUI) til web/PWA (React), eller skal begge spor forfølges parallelt? Nuværende kode er udelukkende React. Se [04_Project_History](04_Project_History.md) og [09_Lessons_Learned](09_Lessons_Learned.md).
2. **Teststrategi**: Hvornår indføres automatiseret test (unit/integration/UI), som Release Plan forudsætter før release? Se [08_Development_Standards](08_Development_Standards.md).
3. **Persistent Google-forbindelse**: ADR-009 udskyder refresh-token/backend. Dette skal besluttes, før Fase 2-notifikationer og en stabil brugeroplevelse kan bygges på Google-integrationen.

---

## Dokumentets rolle

Dette dokument beskriver den planlagte, endnu ikke gennemførte udvikling. Når en fase eller version påbegyndes, flyttes den til [05_Sprint_History](05_Sprint_History.md) med faktisk status.
