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
