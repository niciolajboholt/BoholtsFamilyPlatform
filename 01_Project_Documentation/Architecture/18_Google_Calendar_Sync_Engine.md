# 18 – Google Calendar Sync Engine

**Projekt:** Boholts Family Platform

**Version:** 1.0

**Status:** Technical Specification

**Sidst opdateret:** Juli 2026

---

# Formål

Dette dokument beskriver arkitekturen, datastrømmen og synkroniseringsstrategien mellem Boholts Family Platform og eksterne kalenderudbydere.

Den første version understøtter:

- Google Calendar

Arkitekturen designes fra starten til senere at understøtte:

- Apple Calendar
- Microsoft Outlook
- Exchange
- CalDAV

---

# Designmål

Sync Engine skal være:

- Offline First
- Hurtig
- Robust
- Konfliktsikker
- Udvidelig
- Uafhængig af UI

Brugerfladen må aldrig kommunikere direkte med Google Calendar.

---

# Overordnet arkitektur

```text
             SwiftUI

                │

         ViewModels

                │

        CalendarRepository

                │

            SwiftData

                │

          Sync Engine

                │

      Google Calendar API
```

---

# Ansvarsfordeling

## SwiftUI

Viser data.

Ingen netværkskald.

---

## ViewModels

Kommunikerer med Repository.

Ingen API-kald.

---

## Repository

Læser og skriver data i SwiftData.

Starter synkronisering ved behov.

---

## Sync Engine

Ansvarlig for:

- upload
- download
- konfliktløsning
- fejlhåndtering
- køhåndtering

---

## Google API Service

Kommunikerer med Google Calendar API.

Ingen logik.

Kun HTTP-kald.

---

# Offline First

Brugeren arbejder altid lokalt.

Eksempel:

```text
Ny aftale

↓

Gemmes i SwiftData

↓

Vises straks

↓

Markeres som Pending

↓

Uploades senere
```

Brugeren skal aldrig vente på internettet.

---

# Synkroniseringsstatus

Alle Events har en status.

```swift
enum SyncStatus {

case local

case pending

case synced

case conflict

case failed

}
```

---

# Synkroniseringsflow

## Opret ny aftale

```text
Bruger

↓

SwiftData

↓

Pending

↓

Sync Queue

↓

Google API

↓

Synced
```

---

## Rediger aftale

```text
Lokal ændring

↓

Pending

↓

Upload

↓

Google

↓

Synced
```

---

## Slet aftale

```text
Soft Delete

↓

Pending Delete

↓

Google Delete

↓

Synced
```

---

# Download-flow

Ved opstart

```text
Google

↓

API

↓

Sync Engine

↓

SwiftData

↓

UI opdateres
```

---

# Konflikthåndtering

Konflikter opstår når:

- samme event ændres lokalt
- og samtidigt ændres hos Google

---

## Strategi

Version sammenlignes.

```text
Hvis

Google nyere

↓

Download

Ellers

Upload
```

Ved tvivl markeres:

```
Conflict
```

Brugeren kan senere vælge hvilken version der skal beholdes.

---

# Sync Queue

Alle handlinger placeres i en kø.

Eksempel

```text
1

Ny aftale

↓

2

Rediger aftale

↓

3

Slet aftale
```

Fordele

- ingen tabte ændringer
- fungerer offline
- lettere fejlretning

---

# Retry strategi

Hvis upload fejler

↓

Vent 30 sekunder

↓

Nyt forsøg

↓

1 minut

↓

5 minutter

↓

15 minutter

↓

1 time

Maksimalt antal forsøg:

10

---

# Fejlhåndtering

Eksempel

Ingen internet

↓

Event gemmes lokalt

↓

Status = pending

↓

Automatisk upload senere

Brugeren mister aldrig data.

---

# Authentication

Google OAuth2

Flow

```text
Login

↓

Google OAuth

↓

Access Token

↓

Refresh Token

↓

Gem sikkert

↓

Klar
```

Tokens gemmes i Keychain.

Aldrig i SwiftData.

---

# Kalendermapping

Google Calendar

↓

Internal Calendar

Eksempel

```text
Google

↓

Arbejde

↓

Calendar()

↓

SwiftData
```

---

# Event Mapping

Google Event

↓

Internal Event

Felter der synkroniseres:

- titel
- beskrivelse
- lokation
- start
- slut
- heldag
- deltagere
- kalender
- farve

---

# Data der ikke synkroniseres

Lokale indstillinger.

Eksempel

- favoritvisning
- dark mode
- UI-indstillinger

---

# Hastighedsmål

Mål:

- Login < 2 sekunder
- Download 1000 events < 3 sekunder
- Opret event < 100 ms lokalt
- Synkronisering i baggrunden uden at blokere UI

---

# Sikkerhed

Alle forbindelser:

HTTPS

TLS

OAuth2

Ingen persondata logges.

Ingen tokens logges.

---

# Fremtidige integrationer

Samme Sync Engine skal senere understøtte:

- Apple Calendar
- Outlook
- Exchange
- CalDAV

Derfor implementeres en Provider-struktur.

```swift
protocol CalendarProvider {

func fetchEvents()

func createEvent()

func updateEvent()

func deleteEvent()

}
```

Google bliver første implementering.

---

# Performance

Sync Engine må aldrig blokere UI.

Alle netværkskald udføres asynkront.

Parallel download anvendes hvor muligt.

---

# Logging

Logniveauer:

- Info
- Warning
- Error
- Debug (kun udvikling)

Ingen personfølsomme oplysninger må logges.

---

# Teststrategi

Der skal udvikles tests for:

- Login
- Upload
- Download
- Konflikter
- Offline
- Retry
- Fejlscenarier

Målet er minimum 90 % testdækning af Sync Engine.

---

# Fremtidige forbedringer

Planlagte funktioner:

- Push-notifikation ved eksterne ændringer
- Webhooks
- Realtidssynkronisering
- AI-baseret konfliktløsning
- Intelligent prioritering af synkø

---

# Konklusion

Sync Engine er hjertet i Boholts Family Platforms integrationslag.

Ved at lade SwiftData være den primære datakilde og lade al ekstern kommunikation gå gennem Sync Engine opnås:

- Offline First
- Høj ydeevne
- Robust synkronisering
- Nem udvidelse til nye kalenderudbydere
- Ensartet arkitektur

Denne arkitektur gør platformen klar til både MVP og fremtidige avancerede funktioner.

---

## Relaterede dokumenter

- 04 – Teknisk Arkitektur
- 09 – Data Model
- 11 – Google Calendar Integration
- 16 – SwiftData Database Design
- 17 – UI Component Library
- 19 – Release Plan
- 20 – Master Development Specification