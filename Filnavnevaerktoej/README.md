# Filnavneværktøj

Filnavneværktøj er et selvstændigt Windows-program til sikker, struktureret
masseomdøbning af filer. Programmet guider brugeren gennem en trinvis
proces (en "wizard"): vælg filer, opsæt omdøbningsregler med levende
forhåndsvisning, kontrollér ændringerne, og udfør omdøbningen - med fuld
mulighed for at fortryde bagefter.

Programmet er bygget til fagfolk, der jævnligt skal omdøbe store mængder
filer efter faste navngivningsstandarder - f.eks. tegninger, IFC-filer eller
PDF-dokumenter i bygge- og anlægsbranchen - men fungerer lige så godt til
almindelig oprydning i private filer.

## Skærmbilleder

> Pladsholder: Skærmbillede af trin 1 - "Vælg filer" (mappevalg, filter og fundne filer).
>
> Pladsholder: Skærmbillede af trin 2 - "Tilpas filnavne" (regler til venstre, levende forhåndsvisning til højre).
>
> Pladsholder: Skærmbillede af trin 3 - "Kontrollér og omdøb" (bekræftelsesliste).
>
> Pladsholder: Skærmbillede af resultatsiden efter en gennemført omdøbning.

## Systemkrav

- Windows 10 eller Windows 11, 64-bit (x64)
- Ingen administratorrettigheder påkrævet
- Ingen internetforbindelse påkrævet
- Ingen forudinstalleret .NET-runtime påkrævet ved brug af de selvstændige
  ("self-contained") builds

## Teknologi

- C# og .NET 8
- WPF (Windows Presentation Foundation) med MVVM-arkitektur
- Ingen afhængighed af PowerShell eller andre eksterne værktøjer ved kørsel

## Projektstruktur

```
Filnavnevaerktoej/
├── Filnavnevaerktoej.sln
├── src/
│   ├── Filnavnevaerktoej.App/     WPF-brugerflade (MVVM)
│   └── Filnavnevaerktoej.Core/    Modeller, regler, validering, omdøbningsmotor
├── tests/
│   └── Filnavnevaerktoej.Tests/   Unit tests (xUnit)
├── installer/
│   └── Filnavnevaerktoej.iss      Inno Setup-installationsscript
├── build-release.ps1              Samlet build-/publicerings-/pakke-script
├── BUILD.md, USERGUIDE.md, CHANGELOG.md, LICENSE.txt
```

## Sådan bygges programmet

Forudsætning: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
på en Windows-maskine (WPF kan kun bygges og køres på Windows).

```powershell
dotnet restore Filnavnevaerktoej.sln
dotnet build Filnavnevaerktoej.sln -c Release
```

Se [BUILD.md](BUILD.md) for præcise, uddybede buildkommandoer.

## Sådan køres tests

```powershell
dotnet test tests\Filnavnevaerktoej.Tests\Filnavnevaerktoej.Tests.csproj -c Release
```

Alle tests bruger midlertidige testmapper og rører aldrig brugerens rigtige
filer. Se [BUILD.md](BUILD.md) for detaljer om testdækningen.

## Sådan publiceres programmet

```powershell
dotnet publish src\Filnavnevaerktoej.App -p:PublishProfile=win-x64-singlefile
dotnet publish src\Filnavnevaerktoej.App -p:PublishProfile=win-x64-folder
```

Eller kør det samlede script, som bygger, tester, publicerer og pakker det
hele i én omgang:

```powershell
.\build-release.ps1
```

## Sådan bygges installationen

Installationen bygges med [Inno Setup](https://jrsoftware.org/isdl.php)
(gratis). Når programmet er publiceret (se ovenfor):

```powershell
iscc installer\Filnavnevaerktoej.iss
```

Se [BUILD.md](BUILD.md) for den fulde, præcise kommando og forudsætninger.

## Sådan bruges wizardens tre trin

**Trin 1 - Vælg filer.** Vælg (eller indtast) den mappe, filerne ligger i.
Angiv evt. et filtypefilter (fx `*.dwg` eller `*.dwg;*.pdf`), og vælg om
undermapper, skjulte filer og systemfiler skal medtages. Listen nederst
viser de filer, der er fundet.

**Trin 2 - Tilpas filnavne.** Aktivér én eller flere omdøbningsregler i
venstre side (slet tekst, erstat tekst, tilføj tekst, regex, store/små
bogstaver, nummerering). Den højre side viser løbende, hvad resultatet
bliver - med farvekodet status, filtrering og søgning.

**Trin 3 - Kontrollér og omdøb.** Gennemgå den endelige liste over filer,
der bliver omdøbt. Marker "Jeg har kontrolleret ændringerne", og klik
"Omdøb filer". Bagefter vises en resultatside med mulighed for at åbne
mappen, gemme en rapport, fortryde omdøbningen, starte forfra eller lukke.

## Eksempel: almindelig omdøbning

Filnavn: `FloorPlan-NB5_K01_H1_E0-Niveau0.dwg`

- Regel "Slet tekst": slet `FloorPlan-`
- Regel "Erstat tekst": find `-Niveau0`, erstat med ` - Niveau 0`

Resultat: `NB5_K01_H1_E0 - Niveau 0.dwg`

## Eksempel: regex-omdøbning

- Regex-mønster: `^FloorPlan-(.+)-Niveau(\d+)$`
- Regex-erstatning: `$1 - Niveau $2`

| Oprindeligt filnavn                          | Nyt filnavn                       |
|-----------------------------------------------|------------------------------------|
| `FloorPlan-NB5_K01_H1_E0-Niveau0.dwg`         | `NB5_K01_H1_E0 - Niveau 0.dwg`     |
| `FloorPlan-NB5_K01_H1_E0-Niveau1.dwg`         | `NB5_K01_H1_E0 - Niveau 1.dwg`     |
| `FloorPlan-NB5_K02_H1_E0-Niveau2.pdf`         | `NB5_K02_H1_E0 - Niveau 2.pdf`     |
| `FloorPlan-NB5_K03_H2_E0-Niveau10.ifc`        | `NB5_K03_H2_E0 - Niveau 10.ifc`    |

## Fortrydelse (undo)

Før hver omdøbning gemmes en detaljeret undo-log lokalt på maskinen. Klik
"Fortryd seneste omdøbning" på resultatsiden - eller find en tidligere
operation i "Historik" - for at få filerne tilbage til deres oprindelige
navne. Fortrydelsen kontrollerer for nye konflikter, viser en
forhåndsvisning, og overskriver aldrig en eksisterende fil. Kun filer, der
blev omdøbt med succes, kan fortrydes.

## Placering af profiler, historik og logs

Alle programdata gemmes lokalt under brugerens profil - aldrig i den mappe,
der omdøbes:

| Data      | Placering                                              |
|-----------|---------------------------------------------------------|
| Profiler  | `%LocalAppData%\Filnavnevaerktoej\Profiles`             |
| Historik/undo | `%LocalAppData%\Filnavnevaerktoej\History`          |
| Logs      | `%LocalAppData%\Filnavnevaerktoej\Logs`                 |

Disse placeringer vises også i programmets "Om"-dialog.

## Kendte begrænsninger

- Programmet er udviklet og testet på Linux i denne udviklingssession, da
  WPF/Windows Desktop-værktøjerne kun understøttes af .NET SDK'et på
  Windows. Core-projektet (al forretningslogik: regler, validering,
  omdøbningsmotor, undo, profiler, CSV-rapport) er fuldt bygget og testet
  med 97 beståede unit tests. WPF-brugerfladen (App-projektet) er skrevet
  færdig efter samme MVVM-mønster og er grundigt gennemgået manuelt, men
  skal bygges, køres og verificeres visuelt på en Windows-maskine med
  .NET 8 SDK, før den endelige EXE/installer kan genereres - se BUILD.md.
- Kontrol af låste/optagede filer sker ved at forsøge at åbne filen; i
  sjældne tilfælde kan et program frigive og genoptage en fillås mellem
  kontrol og selve omdøbningen.
- Regex-motoren er .NET's indbyggede regulære udtryk; meget avancerede
  mønstre (fx catastrophic backtracking) kan i teorien være langsomme på
  meget store filmængder.
- Titel-format ved store/små bogstaver bruger simpel ord-grænse-logik
  (bogstaver/tal vs. andre tegn) og følger ikke danske
  sammensætnings-/småords-regler for titelcasing.

## Fejlfinding

- **Programmet starter ikke:** Kontrollér at du har en 64-bit udgave af
  Windows 10/11. Hvis du bruger den mappebaserede build, skal hele mappen
  følges med - kopiér ikke kun EXE-filen alene.
- **"Der opstod en uventet fejl":** Dialogen viser en knap til at kopiere
  tekniske detaljer, samt stien til logfilen. Vedhæft begge dele, hvis du
  beder om hjælp.
- **En fil kunne ikke omdøbes:** Se fejlbeskeden på resultatsiden - typiske
  årsager er, at filen er åben i et andet program, eller at den er
  skrivebeskyttet.
- **Jeg kan ikke se mine seneste ændringer i historikken:** Historikken
  ligger i `%LocalAppData%\Filnavnevaerktoej\History` - kontrollér at dette
  ikke er blevet ryddet af en oprydningsapp e.l.
