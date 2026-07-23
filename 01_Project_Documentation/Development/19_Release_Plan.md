# 19 – Release Plan

**Projekt:** Boholts Family Platform

**Version:** 1.0

**Status:** Release Strategy

**Sidst opdateret:** Juli 2026

---

# Formål

Dette dokument beskriver den overordnede plan for udvikling, test og udgivelse af Boholts Family Platform.

Planen opdeles i klare milepæle, så projektet kan udvikles iterativt med fokus på kvalitet, stabilitet og brugeroplevelse.

---

# Udviklingsprincip

Projektet udvikles i små, færdige iterationer.

Hver version skal være:

- Stabil
- Testbar
- Dokumenteret
- Potentielt udgivelsesklar

Vi bygger få funktioner ad gangen, men gør dem færdige.

---

# Release Roadmap

```text
Planlægning
      │
      ▼
Proof of Concept
      │
      ▼
Alpha
      │
      ▼
Beta
      │
      ▼
Release Candidate
      │
      ▼
Version 1.0
```

---

# Fase 1 – Proof of Concept (POC)

## Formål

Bevise at den tekniske arkitektur fungerer.

## Funktioner

- Opret familie
- Opret personer
- Kalendervisning
- Opret/rediger/slet aftaler
- Lokal lagring med SwiftData
- Grundlæggende navigation

## Ikke inkluderet

- Login
- Deling
- Push-notifikationer
- Widgets

## Succeskriterier

- Appen starter uden fejl
- Data gemmes korrekt
- Kalenderen fungerer stabilt

---

# Fase 2 – Alpha

## Formål

Første komplette interne version.

## Funktioner

- Google Login
- Google Calendar integration
- Tovejs synkronisering
- Konflikthåndtering
- Personlige kalendere
- Familiekalender

## Test

Kun intern test.

---

# Fase 3 – Beta

## Formål

Daglig brug af appen i egen familie.

## Funktioner

- Stabil synkronisering
- Hurtig kalender
- Dark Mode
- Indstillinger
- Fejlrettelser
- Performanceoptimering

## Test

Familien anvender appen som primær kalender.

Alle fejl registreres.

---

# Fase 4 – Release Candidate

## Fokus

Ingen nye funktioner.

Kun:

- Fejlrettelser
- Performance
- UI-polering
- Tilgængelighed
- Batteriforbrug
- Stabilitet

---

# Version 1.0

## Mål

Første offentlige version.

## Funktioner

- Familieoversigt
- Kalender
- Google Calendar
- Offline First
- Agenda
- Ugevisning
- Månedvisning
- Opret/rediger/slet aftaler
- Familieprofiler

---

# Version 1.1

Planlagte funktioner

- Widgets
- Apple Calendar
- Hurtige handlinger
- Flere kalenderfiltre

---

# Version 1.2

Planlagte funktioner

- Opgaver
- Indkøbsliste
- Påmindelser
- Gentagne aftaler

---

# Version 2.0

Platformen udvides med:

- Budget
- Madplan
- Dokumenter
- Ferieplanlægning
- AI-assistent

---

# Sprintmodel

Alle sprints varer 2 uger.

Eksempel

Sprint 1

- Familie
- Person

Sprint 2

- Kalender

Sprint 3

- Events

Sprint 4

- Google Sync

Sprint 5

- Test

Sprint 6

- Polering

---

# Kvalitetskrav

Før en release skal følgende være opfyldt:

- Ingen kritiske fejl
- Ingen datatab
- Ingen kendte crash
- Alle tests består
- Dokumentation opdateret

---

# Teststrategi

## Unit Tests

Alle modeller testes.

---

## Integration Tests

Test af:

- Google Sync
- SwiftData
- Repository
- Services

---

## UI Tests

Automatiserede tests af:

- Navigation
- Kalender
- Oprettelse af aftaler
- Redigering
- Sletning

---

## Manuel test

Kontrol af:

- Animationer
- Dark Mode
- VoiceOver
- Performance
- Batteriforbrug

---

# Performancekrav

Appen skal kunne:

- Starte på under 2 sekunder
- Skifte måned på under 200 ms
- Gemme en aftale øjeblikkeligt
- Håndtere mindst 100.000 events uden mærkbar forsinkelse

---

# Sikkerhed

Før offentlig udgivelse skal følgende være implementeret:

- OAuth2
- Keychain-lagring
- HTTPS
- Ingen følsomme data i logs
- Validering af alle API-kald

---

# App Store-forberedelse

Der skal udarbejdes:

- App Store-beskrivelse
- Skærmbilleder
- App-ikon
- Privatlivspolitik
- Supportside
- Versionshistorik

---

# Succeskriterier

Version 1.0 anses som en succes når:

- Familien anvender appen dagligt
- Google Calendar fungerer stabilt
- Ingen datatab opleves
- Kalenderen opleves hurtigere og mere overskuelig end den nuværende løsning
- Arkitekturen er klar til udvidelser

---

# Risici

Mulige risici:

- Ændringer i Google Calendar API
- Kompleks konflikthåndtering
- Performance ved meget store kalendere
- Tid til test og kvalitetssikring

For hver risiko skal der udarbejdes en afbødningsstrategi før offentlig release.

---

# Definition of Done

En release er først færdig når:

- Alle planlagte funktioner er implementeret
- Alle tests er bestået
- Ingen kritiske fejl er åbne
- Dokumentation er opdateret
- Koden er reviewet
- Projektet kan bygges fra et rent repository

---

# Konklusion

Denne releaseplan sikrer en kontrolleret udvikling fra den første prototype til en stabil og skalerbar platform.

Ved at fokusere på små, færdige leverancer reduceres risikoen, samtidig med at projektet hele tiden kan demonstrere reel værdi.

---

## Relaterede dokumenter

- 08 – Development Plan
- 14 – POC Sprint Plan
- 15 – Xcode Projektstruktur og Første Implementation
- 18 – Google Calendar Sync Engine
- 20 – Master Development Specification