# Projektstatus

Senest opdateret: 2026-08-13

## Aktuel fase

Version 1.1 er released til `main`. Featureudvikling kører normalt igen —
stabiliseringsmilepælen efter den eksterne audit blev afsluttet 2026-07-30, og
alt arbejde siden (Sprint 17–18 samt kalenderplanlæggeren) er merget.

## Leveret på `main`

- React/TypeScript/Vite-webapp med mobilvenligt familie-dashboard.
- Måneds-, uge-, dags- og "side-by-side" familieplanlægger-visning af
  kalenderaftaler.
- Opret, redigér, slet og gendan lokale aftaler, inkl. gentagne aftaler
  (Apple Calendar-stil regler).
- Dynamiske familiemedlemmer og personlige farver.
- Førstegangs-onboarding med generiske standardnavne (ADR-015).
- Google Calendar læse- og skriveintegration.
- Outlook Calendar-integration bygget (ADR-016) — **midlertidigt deaktiveret**
  i kode, afventer IT-godkendelse hos Nicolajs arbejdsgiver.
- Vitest-testpakke.

## Kendte, bevidst åbne punkter

- Apple Calendar er udskudt — kræver appens første server-komponent
  (CalDAV-proxy).
- "Flere Google-konti pr. familie" er ikke planlagt endnu — kræver egen ADR
  og planlægningsrunde (se Knowledge Base, `10_Future_Roadmap.md`).
- Komponent-/hook-tests i Strict Mode og Playwright-flows er ikke
  påbegyndt (F-07, del 2).
- Fysisk iPhone/Safari/VoiceOver-test er ikke udført (kræver Nicolajs egen
  enhed, kan ikke udføres af en AI-agent).

## Næste skridt

1. IT-godkendelse af Outlook-integrationen hos arbejdsgiveren, så den kan
   slås til.
2. Beslut og planlæg næste feature (fx flere Google-konti pr. familie, eller
   noget fra Fase 2/3 i roadmap'en).

Se [01_Project_Documentation/AI_Knowledge_Base/05_Sprint_History.md](01_Project_Documentation/AI_Knowledge_Base/05_Sprint_History.md)
for det fulde, sprint-for-sprint overblik, og
[01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md](01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md)
for planlagt, endnu ikke gennemført udvikling.
