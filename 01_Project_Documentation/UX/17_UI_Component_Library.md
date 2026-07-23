# 17 – UI Component Library

**Projekt:** Boholts Family Platform

**Version:** 1.0

**Status:** Design Specification

**Sidst opdateret:** Juli 2026

---

# Formål

Dette dokument beskriver alle UI-komponenter, designprincipper og visuelle retningslinjer for Boholts Family Platform.

Målet er at sikre en ensartet brugeroplevelse på tværs af hele appen.

Dokumentet fungerer som designmanual for både udvikling og fremtidige udvidelser.

---

# Designfilosofi

Boholts Family Platform skal føles:

- Enkel
- Hurtig
- Rolig
- Familievenlig
- Moderne
- iOS-native

Vi følger Apples Human Interface Guidelines, men med vores eget visuelle udtryk.

---

# Designprincipper

## Kalenderen er centrum

Kalenderen er appens primære skærm.

Brugeren skal kunne:

- få overblik på få sekunder
- oprette aftaler hurtigt
- redigere direkte i kalenderen
- filtrere uden kompleksitet

---

## Maksimalt tre tryk

De mest brugte funktioner skal kunne udføres på højst tre tryk.

Eksempler:

- Opret aftale
- Rediger aftale
- Skift uge
- Skift visning

---

## Farver bruges som information

Farver skal hjælpe brugeren – ikke pynte.

Farver bruges til:

- personer
- kalendere
- status
- prioritet

---

# Designsystem

## Primær farve

```text
Accent Color

Dynamic iOS Color
```

Bruger systemets accentfarve som standard.

---

## Baggrund

Light Mode

```
System Background
```

Dark Mode

```
System Background
```

Ingen hårdkodede farver.

---

## Sekundære farver

Cards

```
SecondarySystemBackground
```

Grupper

```
GroupedBackground
```

Separator

```
Separator
```

---

# Personfarver

Hver person får én gennemgående farve.

Eksempel

| Person | Farve |
|---------|--------|
| Nicolaj | Blå |
| Christine | Lilla |
| Alfred | Grøn |
| Jens | Orange |

Farven bruges på:

- events
- avatar
- kalender
- chips
- badges

---

# Typografi

SwiftUI Fonts

## Large Title

Bruges kun på hovedskærme.

---

## Title

Bruges til sektioner.

---

## Headline

Bruges til kort.

---

## Body

Standardtekst.

---

## Caption

Metadata.

Eksempel

```
Opdateret for 2 minutter siden
```

---

# Spacing

Standard spacing

```
8 pt
```

Store sektioner

```
16 pt
```

Skærmkanter

```
20 pt
```

Store cards

```
24 pt
```

---

# Hjørneradius

Buttons

```
12
```

Cards

```
16
```

Store modaler

```
24
```

---

# Skygger

Kun meget diskrete.

Vi bruger primært dybde gennem:

- spacing
- kontrast
- transparens

Ikke kraftige skygger.

---

# Navigation

Appen anvender TabView.

```
📅 Kalender

👨‍👩‍👧 Familie

⚙️ Indstillinger
```

Fremtidige moduler kan tilføjes senere.

---

# Kalender

Kalenderen understøtter:

- Dag
- Uge
- Måned
- Agenda

Brugeren kan frit skifte mellem dem.

---

# Event Card

Et Event Card består af:

```
Farveindikator

Titel

Tid

Lokation

Deltagere

Status
```

Eksempel

```
🟦

Arbejde

08:00-16:00

Kontoret

Nicolaj
```

---

# Family Card

Viser:

- Avatar
- Navn
- Rolle
- Næste aktivitet

Eksempel

```
🙂

Alfred

Barn

Fodbold kl. 17.00
```

---

# Kalendercelle

Viser:

- Dato
- Event-prikker
- Heldagsbegivenheder
- Valgt dag

Må aldrig blive visuelt overfyldt.

---

# Floating Action Button

Bruges til:

```
+

Opret ny aftale
```

Synlig på kalenderen.

---

# Bottom Sheet

Bruges til hurtige handlinger.

Eksempel

```
Ny aftale

↓

Titel

↓

Tid

↓

Gem
```

---

# Formularer

Alle formularer følger samme struktur.

```
Sektion

↓

Felter

↓

Gem-knap
```

Ingen komplekse dialoger.

---

# Ikoner

Vi anvender udelukkende SF Symbols.

Eksempler

| Funktion | Symbol |
|----------|---------|
| Kalender | calendar |
| Familie | person.3.fill |
| Indstillinger | gearshape |
| Tilføj | plus.circle.fill |
| Rediger | pencil |
| Slet | trash |
| Synkroniser | arrow.triangle.2.circlepath |

---

# Animationer

Animationer skal være hurtige.

Varighed

```
0.2–0.35 sekunder
```

Brug:

- spring animation
- easeInOut

Undgå lange animationer.

---

# Tilgængelighed

Appen skal understøtte:

- VoiceOver
- Dynamic Type
- Høj kontrast
- Farveblindhed
- Stor tekst

---

# Dark Mode

Dark Mode understøttes fra første version.

Ingen komponent må anvende faste hvide eller sorte farver.

Alle farver skal være dynamiske.

---

# Responsive Design

Appen skal fungere på:

- iPhone SE
- iPhone 16
- iPhone Pro Max
- iPad (senere)

---

# Designregler

Alle nye komponenter skal følge disse principper:

- Enkelt udtryk
- Ens spacing
- Dynamiske farver
- SF Symbols
- SwiftUI-native komponenter
- Understøtte Dark Mode

---

# Fremtidige komponenter

Planlagte komponenter:

- AI Assistant Card
- Weather Card
- Shopping List Card
- Meal Planner Card
- Budget Card
- Travel Card
- Notification Center
- Dashboard Widgets

---

# Konklusion

Dette dokument definerer den visuelle identitet for Boholts Family Platform.

Alle nye skærme og komponenter skal følge denne designmanual for at sikre en ensartet, moderne og intuitiv brugeroplevelse.

---

## Relaterede dokumenter

- 06 – UX/UI Design
- 10 – User Flows & Wireframes
- 15 – Xcode Projektstruktur og Første Implementation
- 16 – SwiftData Database Design
- 18 – Google Calendar Sync Engine
- 20 – Master Development Specification