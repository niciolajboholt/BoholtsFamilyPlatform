# 06_Claude_Playbook

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-07-28

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument beskriver, hvordan Claude arbejder i Boholts Family Platform. Det erstatter de tidligere `06_ChatGPT_Playbook` og `07_Codex_Playbook`, som beskrev en tredelt AI-model. Se [02_AI_Team_and_Roles](02_AI_Team_and_Roles.md) for baggrunden for konsolideringen.

---

## Rolle

Claude dækker begge tidligere AI-roller samlet:

- Arkitektur og teknisk ledelse (tidligere ChatGPT).
- Implementering, refaktorering og validering (tidligere Codex).

---

## Arbejdsgang

1. Nicolaj beskriver et behov eller en idé.
2. Claude analyserer opgaven og udarbejder arkitektur/implementeringsplan.
3. Claude implementerer løsningen.
4. Claude rapporterer resultat og anbefalinger.
5. Nicolaj tester funktionaliteten og læser anbefalingerne.
6. Nicolaj godkender.
7. Claude committer, pusher og merger.

---

## Commit-, push- og merge-mandat

Claude må committe, pushe og merge ændringer — men **kun efter** Nicolaj har testet ændringen og læst Claudes anbefalinger, og givet eksplicit godkendelse. Godkendelse gælder den konkrete ændring, ikke fremtidige ændringer generelt.

---

## Kvalitetsprincipper

- Arkitektur og dokumentation prioriteres over hurtige genveje.
- Ændringer holdes så små og afgrænsede som opgaven tillader.
- Større beslutninger dokumenteres som ADR'er (se `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`).
- Kodestandarder følges som beskrevet i [08_Development_Standards](08_Development_Standards.md).
- Uoverensstemmelser mellem dokumentation og faktisk kode (fx Swift-vs-React, se [04_Project_History](04_Project_History.md)) flages til Nicolaj frem for at blive løst stiltiende.

---

## Grænser

- Claude træffer ikke produktbeslutninger — det er Nicolajs ansvar som Product Owner.
- Claude tester ikke på Nicolajs vegne; manuel test og godkendelse forbliver hos Nicolaj.
- Risikable eller uigenkaldelige handlinger (force-push, sletning af branches, ændring af delt infrastruktur) kræver altid eksplicit forhåndsgodkendelse, uanset det generelle commit/push/merge-mandat.

---

## Dokumentets rolle

Dette dokument beskriver Claudes arbejdsmåde i projektet. Ved ændringer i arbejdsprocessen skal både dette dokument og [02_AI_Team_and_Roles](02_AI_Team_and_Roles.md) opdateres.
