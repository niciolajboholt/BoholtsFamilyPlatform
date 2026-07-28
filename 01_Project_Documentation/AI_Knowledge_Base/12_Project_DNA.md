# 12_Project_DNA

> Status: Active

Version: 1.2

Project:
Boholts Family Platform

Last Updated:
2026-07-28 (Sprint 13)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument beskriver projektets identitet, værdier og principper — det, der ikke bør ændre sig, selvom teknologi, roadmap og team gør. Det er udledt af `Vision/01_Vision_Produktstrategi.md` og `Product/02_Produktprincipper.md`.

---

## Kerneværdi

Mindre koordinering. Mere familietid.

---

## Hvorfor projektet findes

Moderne børnefamilier bruger flere forskellige kalendere (personlige, arbejde, børnenes aktiviteter, fælles aftaler), hvilket skaber manglende overblik, dobbeltarbejde og risiko for glemte aftaler. Boholts Family Platform samler dem i én overskuelig familieoplevelse — uden at erstatte de kalendere, familien allerede bruger.

---

## Familien i POC

Forældre: Nicolaj og Christine.
Børn: Alfred og Jens.

Børn skal kunne eksistere som profiler i systemet uden at have egne konti.

---

## Grundprincipper

- **Byg ovenpå eksisterende løsninger.** Appen erstatter ikke Google Calendar, Apple Calendar eller andre integrationer — den samler og forbedrer oplevelsen af dem.
- **Kalenderen er centrum.** Hele familieoplevelsen bygges omkring at kunne se hvem der skal hvad, hvornår, og hvem der deltager.
- **Familien først.** Simpel nok til at bruges uden oplæring — få klik, hurtigt overblik, minimal kompleksitet.
- **Offline first.** Appen skal kunne bruges uden internetforbindelse; data gemmes lokalt og synkroniseres senere.
- **Fremtidssikret arkitektur.** Skal kunne udvides med flere kalenderintegrationer, opgaver, madplan, indkøb og en AI-familieassistent uden at skulle bygges om fra bunden.
- **Funktionalitet før visuel perfektion, men langsigtet vedligeholdbarhed før hurtige løsninger.**

---

## Målgruppe

Børnefamilier, især familier med mange aktiviteter og flere kalendere at holde styr på.

---

## Apple-first er en oplevelsesstrategi, ikke en teknologibegrænsning

Projektet startede med Swift/SwiftUI, men skiftede til React/TypeScript/PWA, fordi udviklingsmaskinen (en ældre Mac) ikke havde adgang til en tilstrækkeligt opdateret Xcode-version — se [04_Project_History](04_Project_History.md). Apple-first betyder derfor i praksis, at Apple-brugere skal have den bedste oplevelse, ikke at koden nødvendigvis skal være native Apple-teknologi. Formaliseret som **ADR-010** i Sprint 13 — se `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`.

---

## Dokumentets rolle

Dette dokument beskriver projektets identitet og principper. Det bør sjældent ændre sig — hvis det gør, er det tegn på en fundamental retningsændring, der bør besluttes bevidst af Nicolaj og dokumenteres som en ADR.
