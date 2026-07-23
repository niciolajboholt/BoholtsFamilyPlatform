# 14 - POC Sprint Plan og Development Backlog

**Projekt:** Boholts Family Platform

**Version:** 0.1

**Status:** Klar til udvikling

---

# 1. Formål

Dette dokument beskriver den første konkrete udviklingsplan for Boholts Family Platform.

Målet er at bygge en fungerende Proof of Concept version.

---

# 2. POC Målsætning

POC skal bevise:

- Familien kan oprettes
- Brugere kan vises
- Kalender kan vises
- Aftaler kan oprettes
- Google Calendar kan integreres
- Data kan gemmes lokalt

---

# 3. Udviklingsprincip

Vi bygger den mindste løsning der beviser produktets værdi.

Fokus:

- Funktion før design
- Stabilitet før kompleksitet
- Genbrug af eksisterende platforme

---

# 4. Sprint Oversigt

## Sprint 0 - Projektfundament

Opgaver:

- Opret Xcode projekt
- Opsæt SwiftUI
- Opsæt SwiftData
- Opret mapper og struktur

---

## Sprint 1 - Familie Model

User Story:

Som familie vil jeg kunne oprette familiemedlemmer.

Funktioner:

- Opret familie
- Tilføj voksne
- Tilføj børn
- Gem profiler

---

## Sprint 2 - Kalender Core

User Story:

Som bruger vil jeg kunne se familiens kalender samlet.

Funktioner:

- Kalender view
- Ugevisning
- Månedvisning
- Agenda

---

## Sprint 3 - Aftaler

User Story:

Som bruger vil jeg kunne administrere aftaler.

Funktioner:

- Opret aftale
- Rediger aftale
- Slet aftale
- Tilknyt person

---

## Sprint 4 - Google Integration

User Story:

Som bruger vil jeg kunne se mine eksisterende kalendere.

Funktioner:

- Google login
- Kalender adgang
- Import af events
- Synkronisering

---

# 5. Første Datamodeller

## Family

Indeholder:

- Familie navn
- Medlemmer
- Events


## Person

Indeholder:

- Navn
- Rolle
- Farve


## Event

Indeholder:

- Titel
- Starttid
- Sluttid
- Deltagere
- Kalenderkilde

---

# 6. Prioriteret Backlog

Prioritet 1:

- Opret projekt
- Familie model
- Kalender model

Prioritet 2:

- Kalender UI
- Event oprettelse
- Lokal lagring

Prioritet 3:

- Google integration
- Synkronisering

---

# 7. Definition of Done

En opgave er færdig når:

- Funktionen virker
- Den kan testes
- Den følger arkitekturen
- Dokumentationen er opdateret

---

# 8. Første udviklingsopgave

Opret første Xcode projekt:

Projekt:

BoholtsFamilyPlatform

Platform:

iOS App

Framework:

SwiftUI

---

# 9. Næste dokument

Dokument 15:

Xcode Projektstruktur og Første Implementation

Dette dokument markerer overgangen til faktisk kodeudvikling.

