# Brugervejledning - Filnavneværktøj

## Kom godt i gang

Filnavneværktøj er en wizard i tre trin, som guider dig gennem at vælge
filer, opsætte omdøbningsregler og udføre selve omdøbningen sikkert.

## Trin 1: Vælg filer

1. Klik **Gennemse...** for at vælge mappen med de filer, du vil omdøbe -
   eller indsæt/skriv stien direkte i feltet.
2. Angiv eventuelt et **filtypefilter**. Du kan skrive det på flere måder:
   - `*.dwg` (én filtype)
   - `*.dwg;*.pdf;*.ifc` eller `dwg,pdf,ifc` (flere filtyper)
   - `*.*` betyder alle filtyper (standard)
3. Vælg om du vil **medtage undermapper**, **skjulte filer** og/eller
   **systemfiler**. Alle tre er slået fra som standard.
4. Listen nederst opdateres automatisk og viser filnavn, filtype, mappe,
   størrelse og senest ændret-tidspunkt for de fundne filer.
5. Klik **Næste**, når du er tilfreds. Knappen er kun aktiv, når mappen er
   gyldig, og der er fundet mindst én fil.

Filnavneværktøj medtager aldrig sine egne interne filer (profiler, logs,
historik), selvom du skulle vælge en mappe, der indeholder dem.

## Trin 2: Tilpas filnavne

Til venstre finder du seks regeltyper. Hver regel har sin egen
**Aktivér**-boks og anvendes kun, når den er slået til. Reglerne udføres i
den rækkefølge, de vises (A til F):

**A) Slet tekst** - fjerner en bestemt tekst fra filnavnet (uden
filendelsen). Kan indstilles til at skelne mellem store og små bogstaver.

**B) Erstat tekst** - finder en tekst og erstatter den med en anden. Du
vælger om alle, kun første eller kun sidste forekomst skal erstattes.

**C) Tilføj tekst** - tilføjer en tekst i starten, i slutningen, før/efter
en bestemt tekst, ved en given tegnposition, eller lige før filendelsen.

**D) Regex-omdøbning** - for avancerede mønstre med .NET-regulære udtryk og
capture groups (`$1`, `$2` osv.). Vælg om mønsteret skal køre på filnavnet
uden filendelse (standard) eller på hele filnavnet inklusive filendelsen.
Er mønsteret ugyldigt, vises en tydelig fejlbesked, feltet fremhæves rødt,
og **Næste** deaktiveres - men resten af programmet fortsætter med at
virke.

**E) Store/små bogstaver** - gør hele filnavnet til små bogstaver, store
bogstaver, første bogstav stort, eller "Titel-format". Filendelsen ændres
ikke.

**F) Nummerering** - tilføjer et fortløbende nummer med valgfrit
startnummer, trin, antal cifre, placering (start/slutning) og tekst
før/efter nummeret.

**Avanceret: Tillad ændring af filendelser** er slået fra som standard.
Slår du den til, vises en tydelig advarsel - filer kan blive ubrugelige for
de programmer, der normalt åbner dem, hvis filendelsen ændres ved en fejl.

Til højre ser du en **levende forhåndsvisning**, som opdateres automatisk
(med en kort forsinkelse, så programmet ikke bliver langsomt ved mange
filer). Hver linje er farvet efter status:

- **Grøn** - filen får et nyt, gyldigt navn
- **Grå** - filnavnet ændres ikke
- **Gul** - advarsel (fx filendelsen ændres, eller filen er skrivebeskyttet)
- **Rød** - fejl eller konflikt (filen omdøbes ikke)

Brug filteret (Alle / Kun ændringer / Kun fejl / Kun uændrede / Kun
advarsler) og søgefeltet til at finde bestemte filer i en stor liste.
Nederst ser du en opsummering med antal fundne, ændrede, uændrede filer,
fejl og advarsler.

**Profiler:** Gem dine regler som en genbrugelig profil (fx "NB5
Tegninger" eller "AFRY IFC"), så du hurtigt kan anvende den samme
navngivningsstandard igen senere. Du kan gemme, indlæse, omdøbe og slette
profiler.

Klik **Næste**, når der er mindst én ændring, og ingen fejl blokerer.

## Trin 3: Kontrollér og omdøb

Her ser du en endelig liste over **kun de filer, der faktisk ændres** -
med nummer, gammelt filnavn, nyt filnavn, mappe og status. Kontrollér
listen grundigt.

Marker **"Jeg har kontrolleret ændringerne"** for at aktivere den primære
knap **Omdøb filer**. Du kan altid vælge **Tilbage** for at justere
reglerne, eller **Annuller** for at afbryde uden at ændre noget.

Når du klikker **Omdøb filer**, kontrollerer programmet filsystemet igen
(i tilfælde af at noget har ændret sig, siden du så forhåndsvisningen),
opretter en undo-log, og udfører selve omdøbningen sikkert via
midlertidige filnavne - så selv navnebytte mellem to filer (A↔B) altid
lykkes uden risiko for datatab.

## Resultatsiden

Efter omdøbningen viser resultatsiden:

- Antal filer omdøbt, antal sprunget over, og antal fejl
- En liste over eventuelle fejl med årsag
- **Åbn mappe** - åbner mappen i Stifinder
- **Gem rapport** - gemmer en detaljeret CSV-rapport (åbner korrekt i dansk
  Excel)
- **Fortryd seneste omdøbning** - se afsnittet om fortrydelse nedenfor
- **Start forfra** - nulstiller wizarden til trin 1
- **Luk** - lukker programmet

## Fortrydelse (undo)

Klik **Fortryd seneste omdøbning** på resultatsiden, eller find en tidligere
operation under **Historik** (knappen øverst i programmet) og klik
**Fortryd valgt operation**.

Du får altid vist en forhåndsvisning af, hvad fortrydelsen vil gøre, før
noget sker. Fortrydelsen:

- Kontrollerer for nye konflikter, før den gendanner noget
- Overskriver aldrig en eksisterende fil
- Bruger samme sikre metode med midlertidige filnavne som selve omdøbningen
- Fortryder kun de filer, der oprindeligt blev omdøbt med succes

## Historik

Klik **Historik...** øverst i programmet for at se alle tidligere
omdøbningsoperationer med dato, mappe, antal filer og status. Vælg en
operation for at se detaljer om hver enkelt fil, eller fortryd operationen
direkte herfra.

## Genveje og tastatur

Programmet kan betjenes fuldt ud med tastaturet. Bogstaver med
understregning i knapper og felter (fx **_G**ennemse) er genvejstaster
(Alt + bogstavet). Enter aktiverer den naturlige næste handling (fx
"Næste" eller "Omdøb filer"). Escape beder om bekræftelse, hvis du er midt
i en igangværende opsætning, i stedet for at lukke programmet med det
samme.
