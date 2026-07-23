# 15 - Xcode Projektstruktur og Første Implementation

**Projekt:** Boholts Family Platform

**Version:** 0.1

**Status:** Klar til første udvikling

---

# 1. Formål

Dette dokument beskriver hvordan den første version af Boholts Family Platform bygges i Xcode.

Fokus er at skabe et stabilt fundament for videre udvikling.

---

# 2. Oprettelse af Xcode Projekt

Projekt:

BoholtsFamilyPlatform

Platform:

iOS App

Teknologi:

SwiftUI

Data:

SwiftData

---

# 3. Første Projektstruktur

Projektet skal indeholde:

App

Models

Views

ViewModels

Services

Storage

Resources

Tests

---

# 4. Første App Entry Point

Første fil:

BoholtsFamilyPlatformApp.swift

Ansvar:

- Starte appen
- Opsætte database
- Initialisere navigation

---

# 5. Første Datamodeller

## Family

Indeholder:

- Id
- Navn
- Medlemmer


## Person

Indeholder:

- Id
- Navn
- Rolle
- Farve


## Event

Indeholder:

- Id
- Titel
- Start
- Slut
- Deltagere

---

# 6. Første Views

Første brugerflader:

## CalendarView

Viser:

- Uge
- Måned
- Agenda


## FamilyView

Viser:

- Familiemedlemmer
- Roller


## SettingsView

Viser:

- Integrationer
- Indstillinger

---

# 7. Navigation

Første navigation:

TabBar:

1. Kalender

2. Familie

3. Indstillinger

---

# 8. Første Implementeringsrækkefølge

Trin 1:

Opret Xcode projekt

Trin 2:

Opsæt SwiftData

Trin 3:

Opret modeller

Trin 4:

Byg kalender view

Trin 5:

Tilføj familievisning

---

# 9. Første Test

Appen skal kunne:

- Starte uden fejl
- Vise kalender skærm
- Vise familie
- Gemme data lokalt

---

# 10. Ikke endnu

Følgende kommer senere:

- Google Sync
- Login
- Notifikationer
- Premium funktioner

---

# 11. Næste dokument

Dokument 16:

SwiftData Model Design og Database Struktur

Dette dokument beskriver den konkrete datastruktur i appen.

