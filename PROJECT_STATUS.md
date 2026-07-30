# Projektstatus

Senest opdateret: 2026-07-29

## Aktuel fase

Stabiliseringsmilepæl efter ekstern audit. Nye features, herunder resten af
Sprint 16, er pauset, indtil Fase 0–1 er valideret.

## Leveret på `develop`

- React/TypeScript/Vite-webapp med mobilvenligt familie-dashboard.
- Måneds-, uge- og dagsvisning af kalenderaftaler.
- Opret, redigér, slet og gendan lokale aftaler.
- Dynamiske familiemedlemmer og personlige farver.
- Google Calendar læse- og skriveintegration.
- Vitest-testpakke.

## Stabiliseringsarbejde

- F-02: `develop` har allerede grønt lint/build/test; de ubrugte imports findes
  kun i den pausede Sprint 16-feature-branch.
- F-03: Strict Mode-indlæsning og kalenderkildevalg rettes med regressionstests.
- F-07: CI til lint, build og test tilføjes.
- F-12: medlemssletning flytter både `ownerIds` og lokal `sourceId`.
- F-14: repositoryets indgangsdokumentation opdateres til den faktiske stack.
- F-16/F-17: dansk metadata og UTF-8-tekster rettes.

## Kvalitetsstatus

Den lokale stabiliseringsbranch består:

- `npm run lint`
- `npm run build`
- `npm test` med 51 tests

Den endelige milepæl kræver desuden grøn GitHub Actions-CI og Nicolajs manuelle
brugertest af de centrale kalenderflows.

## Næste skridt

1. Gennemgå og merge stabiliserings-PR til `develop`.
2. Udfør manuel brugertest.
3. Merge den validerede `develop` til `main`.
4. Opdatér Knowledge Base og genoptag planlægningen af Sprint 16.
