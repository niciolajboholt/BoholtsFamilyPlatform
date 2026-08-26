# Changelog

Alle væsentlige ændringer i Filnavneværktøj dokumenteres i denne fil.

## [1.0.0] - Første udgivelse

### Tilføjet

- Wizard i tre trin: Vælg filer, Tilpas filnavne, Kontrollér og omdøb - samt
  en resultatside.
- Trin 1: mappevalg via Windows-mappevælger eller direkte sti-indtastning,
  automatisk stivalidering, filtypefilter med normalisering af flere
  skrivemåder, indstillinger for undermapper/skjulte filer/systemfiler, og
  en forhåndsvisningsliste over fundne filer.
- Trin 2: seks omdøbningsregeltyper - slet tekst, erstat tekst, tilføj
  tekst, regex-omdøbning (med capture groups og målretning mod filnavn
  eller hele filnavnet), ændring af store/små bogstaver, og fortløbende
  nummerering. Levende, debouncet forhåndsvisning med farvekodet status,
  filtrering, søgning og opsummering. Avanceret, som standard deaktiveret
  indstilling for at tillade ændring af filendelser, med tydelig advarsel.
- Trin 3: bekræftelsesside med fuld liste over ændringer, obligatorisk
  "Jeg har kontrolleret ændringerne"-markering før omdøbning kan udføres.
- Sikker, transaktionel to-trins omdøbningsmotor (midlertidige unikke
  filnavne), som håndterer navnebytte mellem filer (A↔B) uden risiko for
  datatab, med automatisk rollback ved fejl.
- Fuld validering: ugyldige Windows-tegn, reserverede Windows-navne, tomme
  navne, afsluttende punktum/mellemrum, dubletter, konflikter med
  eksisterende filer (pr. mappe), for lange stier, skrivebeskyttede og
  låste filer.
- Resultatside med status pr. fil, mulighed for at åbne mappen, gemme en
  CSV-rapport (semikolon-separeret, UTF-8 med BOM til dansk Excel), starte
  forfra, eller lukke programmet.
- Robust fortrydelsesfunktion (undo) baseret på en lokal undo-log pr.
  operation, med forhåndsvisning og konfliktkontrol før gendannelse.
- Historikside med oversigt over alle tidligere operationer og mulighed
  for at se detaljer eller fortryde direkte derfra.
- Profiler: gem, indlæs, omdøb og slet genbrugelige samlinger af
  filtre/regler, gemt lokalt i brugerens appdata.
- Lokal logning (programstart, version, scanninger, valideringsfejl,
  omdøbningsresultater, rollback-forsøg, undo-operationer, uventede fejl) -
  uden nogensinde at logge filers indhold.
- Global exception handling med en dansk fejldialog, der viser en kort
  besked, mulighed for at kopiere tekniske detaljer, og stien til logfilen.
- Moderne WPF-design med trinindikator, dansk farvekodning (blå som primær
  farve, grøn/rød/gul/grå for status), Segoe UI, DPI-skalering (125 % og
  150 %), skalerbart vindue med minimumsstørrelse, og fuld
  tastaturbetjening med access keys.
- "Om"-dialog med programnavn, version, kort beskrivelse, teknologi og
  placering af log-/historikfiler.
- 97 automatiserede unit tests i Filnavnevaerktoej.Tests, som dækker alle
  regeltyper, validering, filfiltre, undermapper, skjulte filer, danske
  tegn, lange filnavne, undo-data og profilserialisering.
- Publish-profiler til self-contained single-file EXE og mappebaseret
  fallback-build (win-x64), et komplet Inno Setup-installationsscript, og
  et samlet PowerShell-script (`build-release.ps1`) til at bygge, teste,
  publicere og pakke hele releasen.
