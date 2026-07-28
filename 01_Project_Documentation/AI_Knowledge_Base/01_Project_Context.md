# Project Context

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-07

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

# Formål

Boholts Family Platform udvikles for at skabe én samlet platform til familiens planlægning.

Projektet udspringer af et konkret behov for at samle familiens kalendere, skabe bedre overblik og gøre hverdagen lettere uden at erstatte de eksisterende kalenderløsninger.

Platformen skal fungere som familiens centrale planlægningsværktøj.

---

# Vision

At udvikle markedets mest brugervenlige familiekalender.

Systemet skal samle information fra flere kalendere og præsentere dem i ét fælles overblik, samtidig med at brugerne fortsat kan anvende deres foretrukne kalenderløsninger.

Målet er at reducere kompleksitet – ikke at skabe endnu en kalender.

---

# Projektprincipper

Projektet bygger på følgende principper:

- Apple-first som primær platformstrategi.
- Web/PWA som fælles teknologisk fundament.
- Google Calendar er første eksterne integration.
- Lokal kalender understøttes som intern datakilde.
- Arkitekturen skal kunne udvides med flere kalenderudbydere.
- Funktionalitet prioriteres før visuel perfektion.
- Langsigtet vedligeholdbarhed vægtes højere end hurtige løsninger.

---

# Mål

Projektet skal kunne:

- samle flere kalendere
- understøtte fælles familieplanlægning
- vise alle relevante aftaler i ét overblik
- håndtere flere brugere
- fungere på mobil, tablet og computer
- kunne udvides med nye integrationer

---

# Teknologistak

Frontend

- React
- TypeScript
- Material UI

Applikation

- Progressive Web App (PWA)

Versionsstyring

- Git
- GitHub

AI-værktøjer

- Claude

Eksterne integrationer

- Google Calendar API
- Google Identity Services

---

# Arkitekturfilosofi

Projektet anvender en modulær arkitektur.

Eksterne kalenderudbydere isoleres bag provider-abstraktioner, så resten af applikationen ikke afhænger af en specifik kalenderleverandør.

Denne tilgang gør løsningen skalerbar og fremtidssikret.

---

# Dokumentets rolle

Dette dokument beskriver projektets overordnede kontekst.

Detaljer om arkitektur, sprint, udviklingsstandarder og AI-arbejdsgange findes i de øvrige dokumenter i AI Knowledge Base.
