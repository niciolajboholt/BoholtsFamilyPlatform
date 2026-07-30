# 05 - Architecture Decision Records

**Projekt:** Boholts Family Platform

**Version:** 0.1

---

# ADR-001

## SwiftUI

Beslutning:

Appen udvikles i SwiftUI.

Begrundelse:

Moderne Apple framework med god fremtidssikring.

---

# ADR-002

## MVVM

Beslutning:

Projektet bruger Model View ViewModel arkitektur.

Begrundelse:

Giver bedre struktur og testmuligheder.

---

# ADR-003

## Offline First

Beslutning:

Appen skal fungere uden internet.

---

# ADR-004

## Google Calendar Integration

Beslutning:

Google Calendar er første eksterne integration.

Begrundelse:

Familien bruger allerede eksisterende kalendere.

# ADR-006: Platform Strategy – Apple First

**Status:** Accepted
**Date:** 2026-07-24

## Context

Boholts Family Platform is designed as a long-term family platform for managing shared family activities, including calendar coordination, tasks, planning, information sharing and future integrations.

A strategic decision is required regarding the initial technology platform.

The project needs to balance:

* Development speed
* User experience
* Long-term maintainability
* Access to platform-specific capabilities
* Potential future expansion to additional platforms

The primary expected users are Apple device users, and the best initial experience should therefore be created within the Apple ecosystem.

---

## Decision

Boholts Family Platform will follow an **Apple First development strategy**.

The initial target platforms are:

* iPhone
* iPad
* Future possibility: macOS

The primary technology stack will be:

* Swift
* SwiftUI
* SwiftData
* Xcode
* Apple native frameworks

---

## Architectural Principles

Although the first implementation is Apple-specific, the architecture must maintain clear separation between:

```
User Interface Layer
        |
        |
Business Logic Layer
        |
        |
Data Model Layer
        |
        |
Integration Services
```

The goal is to avoid unnecessary dependency between product logic and the user interface implementation.

This allows future clients or platforms to be added without redesigning the entire system.

---

## Consequences

### Positive

* Native Apple user experience

* Full access to Apple ecosystem capabilities

* Faster initial development

* Direct support for:

  * Apple Calendar integration
  * Notifications
  * Widgets
  * iCloud services
  * Siri integrations
  * Future HomeKit possibilities

* Alignment with existing project decisions:

  * SwiftUI architecture
  * SwiftData database design
  * Xcode project structure

---

### Negative

* Requires Apple development hardware
* Android support will require additional implementation effort
* Some future platform-independent services may require additional abstraction

---

## Alternatives Considered

### Cross-platform development

Examples:

* Flutter
* .NET MAUI
* React Native

Rejected for the initial phase because the project prioritizes the best native Apple experience and already has an Apple-focused architecture.

---

### Native iOS and Android development from day one

Rejected because it increases complexity and delays the first usable version.

---

## Future Android Strategy

Android is not part of the initial development scope.

If Android support becomes relevant, it should be implemented as an additional client application connected to the same underlying platform principles, data model and services.

The strategic decision is therefore:

**Apple First — not Apple Only.**

---

## Related Documents

This decision affects:

* 04_Teknisk_Arkitektur.md
* 09_Data_Model.md
* 11_Google_Calendar_Integration.md
* 13_Xcode_Project_Setup_and_Coding_Standards.md
* 15_Xcode_Projectstruktur_og_Foerste_Implementation.md
* 16_SwiftData_Database_Design.md
* 18_Google_Calendar_Sync_Engine.md

---

# ADR-007: Calendar Provider Abstraction

**Status:** Accepted

**Date:** 2026-07-28

## Context

Kalenderen bruger demo-data og localStorage gennem `CalendarService`. Google Calendar er den første planlagte eksterne integration, og Apple Calendar er en fremtidig mulighed i projektets Apple First-retning. UI-laget må derfor ikke bindes direkte til Google-modeller, OAuth, tokens, calendar IDs eller HTTP-endpoints.

## Decision

Kalenderens dataadgang skal gå gennem det leverandøruafhængige `CalendarProvider`-interface. `LocalCalendarProvider` anvendes først som adapter for den eksisterende `CalendarService`, så lokal/offline funktionalitet, localStorage-data og nuværende UI-kontrakter bevares.

En fremtidig Google- eller Apple-provider skal oversætte sine eksterne data og fejl til samme domænekontrakt, før de når hooks eller React-komponenter.

## Alternatives Considered

### Direkte Google Calendar-integration i UI eller hooks

Afvist, fordi UI så skulle kende Google-specifikke modeller og autentifikation, og fordi lokal data og testdata ville kræve særskilte kodeveje.

### React Context som eneste dependency-injection-mekanisme

Afvist, fordi en eksplicit standardinstans og valgfri provider-parameter i hooken giver den nødvendige testbarhed uden ny global state.

### Omskrivning af den lokale lagring

Afvist, fordi en adapter bevarer den eksisterende storage-key og reducerer risikoen for datatab.

## Consequences

### Positive

* Hooks og UI er uafhængige af konkrete kalenderleverandører.
* LocalCalendarProvider bevarer den nuværende lokale funktionalitet.
* Google Calendar kan tilføjes uden at ændre komponenternes dataadgang.
* Apple Calendar kan implementeres senere bag samme kontrakt.
* Test- og demo-providers kan injiceres uden UI-ændringer.

### Negative

* Provider-laget tilføjer få ekstra filer og en oversættelse omkring den lokale service.
* Leverandørspecifikke muligheder implementeres først, når de kan udtrykkes sikkert i det fælles domæne.
# ADR-008: Google Calendar som skrivebeskyttet, valgfri provider

## Status

Accepteret i Sprint 11.1.

## Kontekst

Familiekalenderen bevarer localStorage som standardkilde, men skal kunne vise
Google Calendar uden at Google-identiteter eller OAuth-detaljer spreder sig til
React-komponenter. Google-aftaler har ikke nødvendigvis en lokal deltager.

## Beslutning

Vi anvender `CompositeCalendarProvider` til at samle lokale og valgfrie
Google-kilder. `CalendarEvent.sourceId` identificerer kalenderkilden, mens
`ownerIds` kun indeholder familiens deltagere. Google bruger namespacede,
URL-encoded source- og event-id'er, læses med `calendar.readonly` og er altid
skrivebeskyttet. OAuth-tokenet er kun i hukommelsen.

## Konsekvenser

Lokale data er fortsat tilgængelige, hvis Google fejler. Eksisterende lokale
events uden `sourceId` normaliseres i hukommelsen fra første ownerId og falder
tilbage til `local:family`. Apple Calendar kan senere tilføjes som endnu en
provider uden Google-afhængigheder i UI'et.
# ADR-009: Google Calendar write access uses provider-routed frontend token flow

## Status

Accepteret i Sprint 12.1.

## Kontekst og beslutning

Familiekalenderen skal kunne ændre events i Google-kalendere, hvor brugeren
har write-adgang, uden at sprede Google-typer eller tokens til UI'et. Vi bruger
de mindst privilegerede scopes `calendar.events` og
`calendar.calendarlist.readonly`. `CompositeCalendarProvider` router writes
via `sourceId`; Google source-permission kommer kun fra CalendarList
`accessRole`.

## Konsekvenser

Tokenet ligger kun i memory, og reload kræver ny brugerinitieret forbindelse.
Der er ingen backend, refresh token eller client secret. Attendees,
recurrence-redigering og vedvarende forbindelse er udskudt. Read-only-kilder
forbliver synlige, men UI og provider afviser write uden netværkskald.

# ADR-010: Platformskifte fra Swift/SwiftUI til React/TypeScript/PWA

## Status

Accepteret i Sprint 13. Formaliserer et skifte, der reelt skete allerede ved
projektstart (2026-07-26), men aldrig blev besluttet eksplicit som en ADR.

## Kontekst

ADR-006 (2026-07-24) besluttede en Apple First-strategi med Swift, SwiftUI,
SwiftData og Xcode som primær teknologistak. Den faktiske implementering, der
blev påbegyndt to dage senere, er i stedet en React 19 + TypeScript-webapp
(Vite, Material UI, PWA). Årsagen er praktisk: udviklingsmaskinen var en
ældre Mac uden adgang til en tilstrækkeligt opdateret Xcode-version til at
understøtte moderne SwiftUI/SwiftData-udvikling. Uden denne beslutning
dokumenteret risikerede vision-, produkt- og arkitekturdokumentation
(baseret på ADR-006) at pege i en anden retning end den faktiske kodebase —
hvilket vi konkret stødte på under AI Knowledge Base-arbejdet i Sprint 12/13.

## Beslutning

Boholts Family Platform udvikles som en **React 19 + TypeScript Progressive
Web App**, ikke en native Swift-app. Dette gælder også fremadrettet, ikke kun
for POC'en.

**Apple First forbliver princippet, men ændrer betydning**: det er en
oplevelsesstrategi (Apple-brugere skal have den bedst mulige oplevelse), ikke
et krav om native Apple-teknologi. PWA'en installeres og fungerer på iPhone/
iPad som på øvrige platforme, og giver dermed en Apple-first-oplevelse uden
en Apple-only teknologistack.

Arkitekturprincippet fra ADR-006 — klar adskillelse mellem UI, forretnings-
logik, datamodel og integrationer — videreføres uændret og er allerede
implementeret via provider-arkitekturen (ADR-007).

## Alternativer overvejet

### Fastholde Swift/SwiftUI og anskaffe nyere Apple-hardware

Afvist for nuværende: ville stoppe udviklingen, mens hardware anskaffes, og
give et rent Apple-only-produkt uden den web/PWA-fleksibilitet, som allerede
er bygget og fungerer.

### Formaliser intet, behold ADR-006 som gældende på papiret

Afvist: efterlader dokumentation og kode i strid med hinanden, hvilket
allerede forvirrede en AI-agent under onboarding (se
`01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`).

## Konsekvenser

### Positivt

* Dokumentation og faktisk kodebase stemmer nu overens.
* Udvikling kan fortsætte uafhængigt af Apple-specifik udviklingshardware.
* PWA'en fungerer allerede på tværs af mobil, tablet og desktop.
* Native Apple-muligheder (widgets, Siri, HomeKit) er ikke opgivet permanent
  — se "Fremtidig Apple-strategi" nedenfor.

### Negativt

* Nogle Apple-specifikke muligheder fra ADR-006 (widgets, Siri, dybe
  HomeKit-integrationer) er ikke tilgængelige via PWA på samme niveau som
  native Swift ville have givet.
* De Swift/SwiftUI/Xcode-specifikke udviklingsdokumenter
  (`01_Project_Documentation/Development/13_Xcode_Project_Setup_and_Coding_Standards.md`,
  `15_Xcode_Projectstruktur_og_Foerste_Implementation.md`,
  `01_Project_Documentation/Architecture/16_SwiftData_Database_Design.md`)
  beskriver nu en ikke-forfulgt retning og bør markeres som historiske eller
  arkiveres i en senere oprydning.

## Fremtidig Apple-strategi

Hvis native Apple-specifikke muligheder (widgets, Apple Watch, dybere
OS-integration) bliver nødvendige, tilføjes de som en supplerende native
klient bag samme provider-arkitektur (ADR-007) — ikke som en genskrivning af
hele platformen. Se `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`,
Fase 3.

## Relaterede dokumenter

Denne beslutning opdaterer den strategiske retning fra ADR-006, men
erstatter den ikke historisk — ADR-006 beskriver stadig, hvorfor Apple First
oprindeligt blev valgt som princip.

* `01_Project_Documentation/AI_Knowledge_Base/04_Project_History.md`
* `01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`
* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`
* `01_Project_Documentation/AI_Knowledge_Base/12_Project_DNA.md`
