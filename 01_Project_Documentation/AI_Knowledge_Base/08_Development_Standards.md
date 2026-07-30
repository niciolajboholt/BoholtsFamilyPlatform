# 08_Development_Standards

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

Dette dokument beskriver de kodestandarder og kvalitetskrav, der gælder for `05_App/web`, baseret på den faktiske opsætning i repoet (ikke et ønsket fremtidsbillede).

---

## Teknologistak

- React 19 + TypeScript
- Vite som build-værktøj
- Material UI (`@mui/material`, `@mui/icons-material`)
- React Router 7
- `vite-plugin-pwa`

---

## Kodekvalitet

- **Linting**: ESLint (flat config) med `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` og `eslint-plugin-react-refresh`. Kør `npm run lint` før commit.
- **Typecheck/build**: `npm run build` kører `tsc -b` efterfulgt af `vite build`. Bygget skal være fejlfrit før en ændring anses for færdig.
- Ingen automatiseret testsuite findes endnu (ingen `*.test.*`/`*.spec.*`-filer, ingen testrunner som devDependency). Kvalitetssikring sker i dag via lint, typecheck og Nicolajs manuelle test. Dette er en kendt mangel — se [09_Lessons_Learned](09_Lessons_Learned.md) og [10_Future_Roadmap](10_Future_Roadmap.md).

---

## Arkitekturprincipper (observeret praksis)

- **Provider-abstraktion**: Alle kalenderkilder implementerer samme `CalendarProvider`-kontrakt (ADR-007). UI og hooks kender aldrig til leverandørspecifikke typer, tokens eller endpoints.
- **Least privilege**: Eksterne integrationer bruger de mindst nødvendige OAuth-scopes (ADR-008, ADR-009).
- **Adskillelse af lag**: Komponenter, formular-hooks (`form/`), domænemodeller (`models/`) og providers (`providers/`) holdes i separate mapper under `src/features/calendar/`.
- **Udskillelse frem for store filer**: Store dialoger/komponenter brydes op i mindre hooks og under-komponenter, når de vokser (jf. Sprint 8-refaktoreringen).
- **ADR'er for arkitekturbeslutninger**: Beslutninger med langsigtet konsekvens dokumenteres i `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` — ikke kun i commit-beskeder.

---

## Commit-konventioner (observeret praksis)

Commits følger i praksis et løst Conventional Commits-mønster:

- `feat(scope): ...` — ny funktionalitet
- `fix(scope): ...` — fejlrettelse
- `refactor(scope): ...` — omstrukturering uden funktionel ændring
- `docs(scope): ...` — dokumentation

Scope er typisk modulnavnet, fx `calendar` eller `ai`.

---

## Dokumentationskrav

- Ændringer i arkitektur skal afspejles i ADR'er og i [03_Architecture_Overview](03_Architecture_Overview.md).
- Afsluttede sprints beskrives i [05_Sprint_History](05_Sprint_History.md).
- Uoverensstemmelser mellem dokumentation og kode (fx platformstrategi) skal flages, ikke skjules — se [04_Project_History](04_Project_History.md).

---

## Dokumentets rolle

Dette dokument beskriver de kvalitetskrav og konventioner, der gælder for udvikling i projektet. Det opdateres, når faktisk praksis ændrer sig — fx når en testsuite indføres.
