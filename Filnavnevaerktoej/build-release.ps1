#Requires -Version 5.1
<#
    .SYNOPSIS
    Bygger, tester, publicerer og pakker Filnavneværktøj til distribution.

    .DESCRIPTION
    Kør dette script fra en Windows-maskine med .NET 8 SDK installeret. Scriptet:
      1. Rydder tidligere build-output
      2. Gendanner NuGet-pakker
      3. Bygger hele solutionen i Release
      4. Kører alle unit tests
      5. Publicerer en single-file selvstændig EXE (win-x64)
      6. Publicerer en mappebaseret selvstændig build (win-x64), som fallback
      7. Pakker den mappebaseret build som en portabel ZIP
      8. Kompilerer Inno Setup-installationen, hvis ISCC.exe findes på PATH

    .EXAMPLE
    .\build-release.ps1
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "== 1. Rydder tidligere build-output ==" -ForegroundColor Cyan
Remove-Item -Recurse -Force "$root\artifacts\publish" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$root\artifacts\publish" | Out-Null
New-Item -ItemType Directory -Force -Path "$root\artifacts\installer" | Out-Null

Write-Host "== 2. Gendanner NuGet-pakker ==" -ForegroundColor Cyan
dotnet restore "$root\Filnavnevaerktoej.sln"
if ($LASTEXITCODE -ne 0) { throw "dotnet restore fejlede." }

Write-Host "== 3. Bygger solutionen (Release) ==" -ForegroundColor Cyan
dotnet build "$root\Filnavnevaerktoej.sln" -c Release --no-restore
if ($LASTEXITCODE -ne 0) { throw "dotnet build fejlede." }

Write-Host "== 4. Kører unit tests ==" -ForegroundColor Cyan
dotnet test "$root\tests\Filnavnevaerktoej.Tests\Filnavnevaerktoej.Tests.csproj" -c Release --no-build
if ($LASTEXITCODE -ne 0) { throw "En eller flere tests fejlede." }

Write-Host "== 5. Publicerer single-file EXE (win-x64) ==" -ForegroundColor Cyan
dotnet publish "$root\src\Filnavnevaerktoej.App\Filnavnevaerktoej.App.csproj" -p:PublishProfile=win-x64-singlefile
if ($LASTEXITCODE -ne 0) { throw "Publicering af single-file EXE fejlede." }

Write-Host "== 6. Publicerer mappebaseret selvstændig build (win-x64) ==" -ForegroundColor Cyan
dotnet publish "$root\src\Filnavnevaerktoej.App\Filnavnevaerktoej.App.csproj" -p:PublishProfile=win-x64-folder
if ($LASTEXITCODE -ne 0) { throw "Publicering af mappebaseret build fejlede." }

Write-Host "== 7. Pakker portabel ZIP ==" -ForegroundColor Cyan
$folderPublish = "$root\artifacts\publish\win-x64\folder"
$zipPath = "$root\artifacts\publish\win-x64\Filnavnevaerktoej-Portable-win-x64.zip"
Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
Compress-Archive -Path "$folderPublish\*" -DestinationPath $zipPath

Write-Host "== 8. Kompilerer Inno Setup-installation (hvis ISCC.exe findes) ==" -ForegroundColor Cyan
$iscc = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
if ($iscc) {
    & $iscc.Path "$root\installer\Filnavnevaerktoej.iss"
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup-kompilering fejlede." }
} else {
    Write-Warning "ISCC.exe (Inno Setup Compiler) blev ikke fundet på PATH. Installer Inno Setup fra https://jrsoftware.org/isdl.php og kør: iscc installer\Filnavnevaerktoej.iss"
}

Write-Host ""
Write-Host "Færdig. Output:" -ForegroundColor Green
Write-Host "  Single-file EXE:  $root\artifacts\publish\win-x64\singlefile\Filnavnevaerktoej.exe"
Write-Host "  Mappebaseret build: $folderPublish\"
Write-Host "  Portabel ZIP:     $zipPath"
Write-Host "  Installer:        $root\artifacts\installer\Filnavnevaerktoej-Setup-1.0.0.exe (hvis Inno Setup var installeret)"
