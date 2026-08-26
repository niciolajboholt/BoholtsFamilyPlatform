# BUILD.md - Præcise buildkommandoer

## Forudsætning

- Windows 10/11, x64 (WPF/Windows Desktop-værktøjerne i .NET SDK'et
  understøttes kun på Windows - se afsnittet "Vigtig bemærkning" nederst).
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) installeret.
- Valgfrit: [Inno Setup](https://jrsoftware.org/isdl.php) for at bygge
  installationsprogrammet.

Alle kommandoer nedenfor køres fra solution-roden: `Filnavnevaerktoej\`.

## 1. Gendan NuGet-pakker

```powershell
dotnet restore Filnavnevaerktoej.sln
```

## 2. Byg i Release

```powershell
dotnet build Filnavnevaerktoej.sln -c Release
```

Forventet resultat: 0 fejl, 0 advarsler for alle tre projekter
(Filnavnevaerktoej.Core, Filnavnevaerktoej.App, Filnavnevaerktoej.Tests).

## 3. Kør tests

```powershell
dotnet test tests\Filnavnevaerktoej.Tests\Filnavnevaerktoej.Tests.csproj -c Release
```

Forventet resultat: alle tests bestået (97 tests i denne levering, jf.
CHANGELOG.md).

## 4. Publicér self-contained builds

Single-file EXE (anbefalet distributionsform):

```powershell
dotnet publish src\Filnavnevaerktoej.App\Filnavnevaerktoej.App.csproj -p:PublishProfile=win-x64-singlefile
```

Output: `artifacts\publish\win-x64\singlefile\Filnavnevaerktoej.exe`

Mappebaseret self-contained build (fallback, hvis single-file af en eller
anden grund ikke er ønsket - fx pga. antivirus-heuristik på selv-udpakkende
EXE-filer):

```powershell
dotnet publish src\Filnavnevaerktoej.App\Filnavnevaerktoej.App.csproj -p:PublishProfile=win-x64-folder
```

Output: `artifacts\publish\win-x64\folder\` (indeholder `Filnavnevaerktoej.exe`
samt alle nødvendige .NET- og WPF-runtime-filer - hele mappen skal følges
med).

## 5. Pak den portable ZIP

```powershell
Compress-Archive -Path artifacts\publish\win-x64\folder\* -DestinationPath artifacts\publish\win-x64\Filnavnevaerktoej-Portable-win-x64.zip
```

## 6. Byg installationen (Inno Setup)

Forudsætter at trin 4 (mappebaseret build) er kørt først.

```powershell
iscc installer\Filnavnevaerktoej.iss
```

Output: `artifacts\installer\Filnavnevaerktoej-Setup-1.0.0.exe`

## Alt i én kommando

```powershell
.\build-release.ps1
```

Kører trin 1-6 automatisk (springer Inno Setup-kompilering over med en
advarsel, hvis `ISCC.exe` ikke findes på PATH).

## Vigtig bemærkning om dette udviklingsmiljø

Denne løsning blev udviklet i en Linux-baseret sandkasse uden adgang til
Windows. Microsofts WPF/Windows Desktop-byggeværktøjer
(`Microsoft.NET.Sdk.WindowsDesktop`-target'et, som `net8.0-windows` +
`UseWPF` kræver) distribueres og understøttes udelukkende via den
Windows-installerede .NET SDK og findes hverken som Linux-apt-pakke eller
som en fungerende cross-platform NuGet-baseret SDK-pakke til .NET 8. Det
blev bekræftet i denne session ved at forsøge både `dotnet workload
install`/`search` (ingen WPF/WindowsDesktop-workload tilbydes på Linux) og
ved at undersøge NuGet for en isoleret `Microsoft.NET.Sdk.WindowsDesktop`-
pakke (kun forældede 3.0.0-versioner findes, inkompatible med .NET 8).

Konsekvens for denne levering:

- **Filnavnevaerktoej.Core** (al forretningslogik: regler, validering,
  omdøbningsmotor, historik/undo, profiler, CSV-rapport) er et almindeligt
  .NET 8-klassebibliotek uden Windows-afhængighed. Det er bygget og testet
  fuldt ud i denne session: `dotnet build` og `dotnet test` er kørt med
  succes (0 advarsler, 0 fejl, 97/97 tests bestået).
- **Filnavnevaerktoej.App** (WPF-brugerfladen) er skrevet fuldt færdig efter
  samme MVVM-arkitektur og er grundigt gennemgået manuelt (alle XAML-filer
  er valideret som velformet XML, og alle ressource-/converter-referencer
  er krydstjekket mod deres definitioner) - men kunne ikke bygges,
  køres eller publiceres i denne sandkasse, da `dotnet build` fejler med
  `MSB4019` (Microsoft.NET.Sdk.WindowsDesktop.targets findes ikke) allerede
  ved projekt-evaluering.
- Trin 2, 4, 5 og 6 ovenfor (byg App-projektet, publicér, pak ZIP, byg
  installer) skal derfor køres på en rigtig Windows-maskine (eller en
  Windows-baseret CI-runner) med .NET 8 SDK, før den endelige EXE, ZIP og
  installer kan genereres og verificeres. De præcise kommandoer ovenfor er
  klar til at blive kørt direkte - der er ikke behov for at ændre noget
  først.

## Testdækning (Core-projektet)

`dotnet test` dækker mindst følgende 30 scenarier, jf. opgavebeskrivelsen:

1. Slet tekst
2. Erstat alle forekomster
3. Erstat første forekomst
4. Erstat sidste forekomst
5. Forskel på store og små bogstaver (slet/erstat)
6. Tilføj i starten
7. Tilføj i slutningen
8. Tilføj før bestemt tekst
9. Tilføj efter bestemt tekst
10. Tilføj ved tegnposition
11. Regex med capture groups
12. Ugyldig regex
13. Nummerering
14. Bevarelse af filendelse
15. Tilladt ændring af filendelse
16. Ugyldige Windows-tegn
17. Reserverede Windows-navne
18. Dublette nye navne
19. Konflikt med eksisterende fil
20. Samme filnavn uden ændring
21. Navnebytte mellem to filer (A↔B)
22. Undo-data (gem, hent, fortryd)
23. Profilserialisering (polymorfe regler)
24. Filfilter med én filtype
25. Filfilter med flere filtyper
26. Undermapper
27. Skjulte filer
28. Filnavne med danske tegn (æ, ø, å)
29. Filnavne med mellemrum
30. Filnavne med meget lange navne
