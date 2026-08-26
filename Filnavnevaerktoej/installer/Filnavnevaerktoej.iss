; Inno Setup-script til Filnavneværktøj.
;
; FORUDSÆTNING: Programmet skal først være publiceret som en mappebaseret,
; selvstændig Windows x64-build, før dette script kan kompileres. Kør fra
; solution-roden (Filnavnevaerktoej\):
;
;   dotnet publish src\Filnavnevaerktoej.App -c Release -p:PublishProfile=win-x64-folder
;
; Dette lægger den færdige applikation i:
;
;   artifacts\publish\win-x64\folder\
;
; Kompilér derefter dette script med Inno Setup Compiler (ISCC.exe), som er
; gratis og kan hentes fra https://jrsoftware.org/isdl.php:
;
;   iscc installer\Filnavnevaerktoej.iss
;
; Den færdige installer lægges i artifacts\installer\Filnavnevaerktoej-Setup-1.0.0.exe.
;
; Hvis Inno Setup ikke er installeret på maskinen, der bygger releasen, er
; dette script stadig komplet og klar til brug, så snart Inno Setup
; installeres på en Windows-maskine.

#define MyAppName "Filnavneværktøj"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Boholt"
#define MyAppExeName "Filnavnevaerktoej.exe"
#define MyPublishDir "..\artifacts\publish\win-x64\folder"

[Setup]
AppId={{8F2B7B9E-6D9A-4B1E-9E31-4E2C6D4F1A70}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
; Installer i brugerens egen programmappe uden krav om administrator, hvis muligt.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DisableProgramGroupPage=yes
OutputDir=..\artifacts\installer
OutputBaseFilename=Filnavnevaerktoej-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\src\Filnavnevaerktoej.App\Resources\app.ico

[Languages]
Name: "danish"; MessagesFile: "compiler:Languages\Danish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Opret en genvej på skrivebordet"; GroupDescription: "Ekstra genveje:"; Flags: unchecked

[Files]
; Kildekode, testfiler og midlertidige buildfiler indgår bevidst ikke - kun den
; publicerede, færdige applikation medtages i installationen.
Source: "{#MyPublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Start {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Fjerner ikke brugerens profiler/historik/logs i %LocalAppData% ved afinstallation,
; så brugerens tidligere omdøbningshistorik og gemte profiler bevares.
