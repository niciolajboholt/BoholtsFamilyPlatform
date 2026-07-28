# Architecture Overview

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-07

Owner:
Nicolaj Bach Boholt

Maintained by:
ChatGPT + Codex

---

# Formål

Dette dokument beskriver den overordnede systemarkitektur for Boholts Family Platform.

Det fungerer som indgangen til den tekniske arkitektur og forklarer de centrale designprincipper bag løsningen.

---

# Arkitekturprincipper

Projektet bygger på følgende grundprincipper:

- Modulær arkitektur.
- Lav kobling mellem komponenter.
- Høj sammenhæng inden for hvert modul.
- Udskiftelige integrationer.
- Genanvendelige services.
- Klar adskillelse mellem UI, domænelogik og datakilder.

---

# Overordnet arkitektur

Applikationen består af fire hovedlag:

## Præsentationslag

Ansvar:

- React-komponenter
- Material UI
- Navigation
- Dialoger
- Kalender-visninger

---

## Applikationslag

Ansvar:

- State management
- Calendar Engine
- Forretningslogik
- Routing mellem providers
- Kommandoer

---

## Provider-lag

Provider-laget abstraherer alle kalenderkilder.

Alle integrationer implementerer den samme kontrakt.

Aktuelle providers:

- LocalCalendarProvider
- GoogleCalendarProvider
- CompositeCalendarProvider

Composite-provideren fungerer som indgangspunkt for resten af systemet.

---

## Datalag

Data kan komme fra flere kilder.

Aktuelt:

- Lokal lagring
- Google Calendar API

Arkitekturen gør det muligt senere at tilføje eksempelvis:

- Apple Calendar
- Microsoft Outlook
- Exchange
- CalDAV
- Andre tredjepartsintegrationer

uden ændringer i applikationslaget.

---

# Calendar Engine

Calendar Engine udgør projektets centrale domænelag.

Ansvar:

- Indlæsning af events
- Sammenlægning af flere kalendere
- Routing til korrekt provider
- Oprettelse af events
- Opdatering af events
- Sletning af events
- Filtrering
- Sortering

Calendar Engine kender ikke detaljer om de enkelte kalenderudbydere.

---

# Google Integration

Google-integrationen bygger på:

- Google Identity Services
- Google Calendar API

Funktionalitet:

- Login
- Læsning af kalendere
- Synkronisering
- Oprettelse af events
- Opdatering af events
- Sletning af events

Rettigheder håndteres ud fra Google Calendar accessRole.

---

# Provider-princippet

Alle providers implementerer samme grænseflade.

Fordele:

- Let testbarhed
- Udskiftelige datakilder
- Ensartet API
- Skalerbar arkitektur

Nye providers kan tilføjes uden at ændre eksisterende forretningslogik.

---

# Progressive Web App

Applikationen udvikles som en Progressive Web App.

Fordele:

- Fungerer på mobil
- Fungerer på tablet
- Fungerer på desktop
- Én fælles kodebase
- Installérbar
- Offline-understøttelse kan udbygges over tid

---

# Designfilosofi

Arkitekturen prioriterer:

- Enkelhed
- Vedligeholdbarhed
- Skalerbarhed
- Testbarhed
- Lang levetid

Tekniske beslutninger vurderes ud fra deres langsigtede konsekvenser frem for kortsigtet udviklingshastighed.

---

# Dokumentets rolle

Dette dokument beskriver systemets overordnede arkitektur.

Detaljerede tekniske beslutninger dokumenteres i projektets ADR'er og øvrige arkitekturdokumentation.
