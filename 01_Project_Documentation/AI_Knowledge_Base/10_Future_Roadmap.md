# 10_Future_Roadmap

> Status: Active

Version: 1.3

Project:
Boholts Family Platform

Last Updated:
2026-07-28 (Sprint 14-forberedelse)

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

## Sprint 14 — Planlagt: Stille genoprettelse af Google-forbindelsen

**Status: Planned.**

**Baggrund**: Google-forbindelsen bruger i dag Google Identity Services' Token Client (`initTokenClient`), som er den korrekte, sikre metode til en ren browser-app uden backend — men Google udleverer bevidst **aldrig** et refresh-token ad den vej. Refresh-tokens kræver Googles Authorization Code-flow, som skal udveksles server-side med et client secret, der aldrig må ligge i browseren. Derfor er "gem et refresh-token i browseren" ikke teknisk muligt med den nuværende arkitektur.

**Beslutning**: Der bygges **ikke** en backend til dette. Begrundelse: appen har 2-4 brugere, og en backend (selv på gratis hosting-niveauer) tilføjer drift, en ny komponent at vedligeholde og risiko for fremtidige omkostninger — uforholdsmæssigt for den værdi, det giver.

**Sprintindhold i stedet**:
- Forsøg en **stille (usynlig) gentilslutning** ved appstart, når `wasEverConnected` er sand (indført i Sprint 13) — uden pop-up, ved at bede Google Identity Services om et nyt access-token, hvis brugeren stadig er logget ind hos Google i samme browser.
- Falder tilbage til det eksisterende "Genforbind"-flow (Sprint 13), hvis det stille forsøg fejler — ingen regression, kun en hurtigere vej, når det virker.
- Tydelig loading-tilstand under det stille forsøg, så brugeren ikke ser en forvirrende blanding af "ikke forbundet" og "forbinder".

**Kendt begrænsning, som forbliver efter Sprint 14**: Dette er stadig ikke en garanteret persistent forbindelse — det afhænger af browserens cookie-/session-tilstand hos Google. Det er en bevidst, omkostningsfri afvejning, ikke en fejl. En ægte persistent forbindelse via en backend er vurderet og fravalgt, se ovenfor.

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

1. ~~**Platformstrategi**~~ — **Afklaret i Sprint 13**: formaliseret som ADR-010. Projektet er React/TypeScript/PWA, med Apple First som oplevelsesstrategi, ikke teknologikrav. Se [04_Project_History](04_Project_History.md) og `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`.
2. **Teststrategi** — **Delvist afklaret i Sprint 13**: Vitest indført, med regressionsdækning af de rene Google-mapper-funktioner. React-komponenter/hooks har fortsat ingen automatiseret test. Se [08_Development_Standards](08_Development_Standards.md).
3. ~~**Persistent Google-forbindelse**~~ — **Afklaret forud for Sprint 14**: en backend/refresh-token-løsning er bevidst fravalgt (omkostning/drift ikke proportional med 2-4 brugere). I stedet bygges stille genoprettelse, se Sprint 14 ovenfor. Dette er en endelig arkitekturbeslutning, ikke kun udskudt.

---

## Dokumentets rolle

Dette dokument beskriver den planlagte, endnu ikke gennemførte udvikling. Når en fase eller version påbegyndes, flyttes den til [05_Sprint_History](05_Sprint_History.md) med faktisk status.
