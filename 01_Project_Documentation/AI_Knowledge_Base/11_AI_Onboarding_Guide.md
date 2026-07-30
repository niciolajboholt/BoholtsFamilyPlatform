# 11_AI_Onboarding_Guide

> Status: Active

Version: 1.1

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

Dette dokument er indgangen for en ny AI-agent (eller en frisk session), der skal orientere sig i projektet uden at have adgang til tidligere samtaler.

---

## Læserækkefølge

1. [00_README](00_README.md) — hvad Knowledge Base er og hvorfor den findes.
2. [01_Project_Context](01_Project_Context.md) — vision, mål, teknologistak.
3. [02_AI_Team_and_Roles](02_AI_Team_and_Roles.md) — hvem gør hvad, og beslutningshierarki.
4. [06_Claude_Playbook](06_Claude_Playbook.md) — hvordan Claude konkret arbejder, herunder commit/push/merge-mandat.
5. [03_Architecture_Overview](03_Architecture_Overview.md) — systemarkitektur og provider-princippet.
6. [04_Project_History](04_Project_History.md) og [05_Sprint_History](05_Sprint_History.md) — hvordan projektet er nået hertil.
7. `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` — de fulde arkitekturbeslutninger (ADR'er), som opsummeres men ikke gentages i denne Knowledge Base.
8. [08_Development_Standards](08_Development_Standards.md) — kodestandarder og kvalitetskrav.
9. [09_Lessons_Learned](09_Lessons_Learned.md) og [10_Future_Roadmap](10_Future_Roadmap.md) — hvad der er lært, og hvad der mangler.

---

## Praktisk orientering i repoet

Ud over dokumentationen bør en ny agent selv verificere aktuel status, da dokumentation kan være bagud i forhold til koden:

- `git log --oneline -20` og `git status` for at se seneste aktivitet og branch.
- `05_App/web/package.json` for faktisk teknologistak.
- `05_App/web/src/features/calendar/` for det eneste implementerede feature-modul.
- `git remote -v` for at bekræfte GitHub-remote.

---

## Kendte faldgruber

- **Dokumentation kan være bagud**: Fx beskriver ADR-001/006 og flere Development-dokumenter en Swift/SwiftUI-app, mens den faktiske kode er React/TypeScript. Verificér altid mod koden, ikke kun mod dokumentationen. Se [04_Project_History](04_Project_History.md).
- **Ingen automatiseret test**: Manuel test og lint/build er i dag den eneste kvalitetssikring. Antag ikke, at en testsuite findes.
- **Flere samtidige AI-/Git-sessioner**: Repoet er observeret ændret (commits, merges, branch-skift) uden for en given AI-agents egen session. Tjek `git status` og `git reflog` ved sessionens start, og flag uventede ændringer til Nicolaj i stedet for at antage egen kontrol over repoet.

---

## Commit/push/merge

Se [06_Claude_Playbook](06_Claude_Playbook.md) for det fulde mandat. Kort opsummeret: commit/push/merge kræver, at Nicolaj har testet og godkendt den konkrete ændring — det er ikke en stående tilladelse.

---

## Dokumentets rolle

Dette dokument er startpunktet for enhver ny AI-agent i projektet. Det henviser videre til de øvrige dokumenter fremfor at gentage deres indhold.
