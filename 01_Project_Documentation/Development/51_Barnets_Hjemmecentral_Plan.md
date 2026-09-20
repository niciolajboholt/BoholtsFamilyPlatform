# 51_Barnets_Hjemmecentral_Plan

Version: 1.0

Project:
Boholts Family Platform (Hjemmecentralen)

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Aktiv roadmap. Første afgrænsede leverance, **"Mit i dag" + "Se som
barn"-forhåndsvisning**, blev implementeret i Sprint 52 og efterfølgende
hardnet 2026-09-19. PIN-baseret børneadgang (Fase 3, se
`53_Sprint53_Barn_Pinkode_Adgang_Plan.md`) og faste rutineskabeloner
(Fase 4, se `54_Sprint54_Rutineskabeloner_Plan.md`) blev begge
implementeret 2026-09-19. Sprint 55 (se
`55_Sprint55_Barn_Adgang_UX_Plan.md`) udbyggede børneadgangen med en
samlet administrationsside, QR-kode, sessionsoverblik, kalenderaftaler
(sikkert delomfang), dansk oplæsning og en minimal besked-funktion.
Oplæsning og beskeder (punkt 5/foreslået indhold) er dermed implementeret
tidligere end den oprindeligt foreslåede rækkefølge tilsagde. De øvrige
faser (point-/mållag, guidede eksterne kalenderforbindelser) er fortsat
ikke implementeret. Arbejdstitel: **Barnets Hjemmecentral**.

---

## Formål

En fremtidig, separat oplevelse i Hjemmecentralen målrettet familiens børn
selv — bygget videre på eksisterende kalender-, opgave- og profildata,
IKKE en ny datamodel fra bunden. Formålet er ét overskueligt "mit i dag"-
overblik, en tryg og enkel adgangsmodel for et barn, og en guidet vej til
at forbinde eksterne, børnerelevante kalendere (skole/fritid), uden at
kopiere andre produkters konkrete design eller kode.

Dette dokument er den overordnede roadmap. Implementerede dele beskrives i
egne sprintplaner; se
`52_Sprint52_Mit_I_Dag_Se_Som_Barn_Plan.md` for første leverance.

---

## Byg videre på eksisterende data — ikke en ny model

Barnets Hjemmecentral skal genbruge det, der allerede findes:

- **Familiemedlemmer** (`family_members`) — et barn er allerede et
  familiemedlem med egen farve og evt. `linked_user_id`.
- **Opgaver og rutiner** (`tasks`, `task_routines`) — allerede personlige
  eller familie-rettede, med "Min dag"-visning, som "Mit i dag" kan
  genbruge direkte.
- **Kalenderaftaler** — allerede kalender-til-medlem-tildelt
  (`calendar_member_mappings`); "barnets aftaler i dag" er et filter på
  eksisterende data, ikke en ny kilde.
- **Opgavebelønning/lommepenge** (`allowance_ledger`) — det eksisterende
  belønningssystem, som et valgfrit point-/mållag kan bygges oven på (se
  "Bevidst ikke nu" nedenfor for afgrænsning).
- **Kiosk-dashboardet** (Sprint 43, `/kiosk`) er det nærmeste eksisterende
  eksempel på en navigationsfri, overbliksorienteret visning og bør
  studeres som udgangspunkt for "Mit i dag"s layout-tænkning (uden at
  kopiere Pointo eller andre eksterne produkter).

---

## Foreslået indhold (til produktafklaring, ikke endeligt)

- **"Mit i dag"-visning**: næste aktivitet fremhævet, dagens egne aftaler
  og opgaver, en kort liste — ikke en fuld kalender.
- **Næste aktivitet**: det først kommende punkt (aftale eller opgave),
  fremhævet separat fra resten af dagen.
- **Små beskeder fra forældre** — **implementeret i Sprint 55 (v1):**
  envejs, ren tekst (280 tegn), læst-kvittering, ingen billeder/filer/
  links/svar fra barnet. Se `55_Sprint55_Barn_Adgang_UX_Plan.md`s Fase E
  for de trufne beslutninger.
- **Oplæsning med dansk browser-talesyntese** — **implementeret i
  Sprint 55:** Web Speech API (`speechSynthesis`) med en dansk stemme,
  hvis tilgængelig i brugerens browser — ingen ekstern TTS-tjeneste,
  ingen ny backend-afhængighed.
- **Moduler pr. familiemedlem**: barnets egen visning tilpasses dets
  alder/behov — kræver en beslutning om, hvor meget der er konfigurerbart
  pr. barn vs. fælles for alle børn.
- **Skabeloner**: morgenrutine, skoletaske, tandbørstning, sengetid — som
  faste `task_routines`-skabeloner, ét niveau over den generiske
  rutine-editor, der findes i dag.
- **Valgfrit point-/målmodel**: et tyndt lag oven på det EKSISTERENDE
  `allowance_ledger`/lommepenge-system (visuelle mål, ikke en ny valuta
  eller shop) — se eksplicit afgrænsning nedenfor mod en stor pointshop.
- **Sikker login-/adgangsmodel for børn**: skal afklares som en selvstændig
  sikkerhedsbeslutning — sandsynligvis en let PIN-kode eller
  billed-baseret adgang bag den voksnes session (barnet logger IKKE selv
  ind med Google/Microsoft/iCloud), ikke en ny fuld kontotype.
- **"Se som barn" for forældre**: en forælder skal kunne forhåndsvise
  barnets visning uden at skifte session — genbruger sandsynligvis samme
  "aktuelt medlem"-mekanisme som `useCurrentMember` gør i dag.
- **Mobil-, tablet- og kioskoplevelse**: kiosk-dashboardets eksisterende
  navigationsfri layout-princip genbruges/udvides, ikke genopfindes.
- **Tilgængelighed**: samme a11y-baseline som resten af appen (Axe/WCAG
  2.1 AA-tests findes allerede i Playwright-suiten) — udvides til at
  dække nye barnerettede komponenter, med ekstra opmærksomhed på store
  trykflader og enkelt sprog.
- **Privatliv og forældrekontrol**: hvilke data kan barnet se om andre
  familiemedlemmer? Kan et barn slette/ændre andres data? Standard bør
  være mest restriktiv (kun eget indhold + delt kalenderoverblik),
  eksplicit besluttet, ikke antaget.

---

## Eksterne kalenderforbindelser: guidede, ikke automatiske

Den eksisterende ICS-abonnementsfunktion (Sprint 18/47-arbejdet,
`icsCalendar.ts`) kan på sigt præsenteres som **guidede forbindelser** til
navngivne danske tjenester som **Aula**, **DBU Kampklar** og **Holdsport**
— dvs. en UI-genvej, der forklarer "sådan finder du dit Aula-ICS-link",
ikke en ny, dedikeret integration pr. tjeneste (ingen af disse tjenester
har i dag en officiel, dokumenteret API-adgang, kun bruger-tilgængelige
ICS/kalender-eksportlinks). Skal undersøges pr. tjeneste, om et sådant
ICS-link overhovedet findes og er stabilt, før en guide skrives.

**Der skal være en forhåndsvisning ("preview") af, hvad en foreslået
forbindelse faktisk vil vise, FØR den aktiveres** — samme mønster som
delelink-forhåndsvisning bør følge, så en forælder ikke aktiverer en
kalenderkilde blindt.

---

## Bevidst ikke nu (eksplicit afgrænsning, gentaget fra opgaven)

Følgende implementeres IKKE som en del af Barnets Hjemmecentral, og skal
ikke antages eller påbegyndes uden en selvstændig, ny beslutning:

- **Pointo Skolen** eller lignende undervisningsindhold.
- **Digitalt kæledyr** eller anden gamification-figur.
- **En stor pointshop** — det eksisterende, valgfrie point-/mållag
  ovenfor er bevidst tyndt og bygger på det nuværende lommepenge-system,
  IKKE en ny økonomi eller et katalog af indløselige belønninger.
- **Familie-subdomæner** (fx `boholt.hjemmecentralen.dk`).
- **En undervisningsplatform**.
- **Kopiering af Pointos design, tekster eller kode.** Produktprincipper
  kan inspirere (fx "børn har brug for enkelhed og struktur"), men intet
  konkret visuelt design, ingen tekst og ingen frontend-kode fra Pointo
  eller lignende kommercielle produkter må genbruges. Hjemmecentralens
  eget designsprog (Material UI-tema, se `05_App/web/src/theme`) er
  udgangspunktet for enhver ny komponent.

---

## Rækkefølge, foreslået (ikke bindende)

1. Produktafklaring af de åbne spørgsmål ovenfor (adgangsmodel for børn,
   besked-omfang, hvor meget er konfigurerbart pr. barn) — kræver
   Nicolajs beslutning, ikke en teknisk plan.
2. **Implementeret i Sprint 52:** "Mit i dag" + næste aktivitet oven på
   eksisterende data. Nicolaj godkendte i den særskilte sprintplan, at
   egne/fælles opgaver må afkrydses fra siden; ingen øvrig skriveadgang.
3. **Implementeret i Sprint 53:** sikker, selvstændig børneadgang med et
   link + en firecifret kode pr. barn, se
   `53_Sprint53_Barn_Pinkode_Adgang_Plan.md`. "Se som barn" (forælderens
   forhåndsvisning fra Sprint 52) findes fortsat separat, uændret.
4. **Implementeret i Sprint 54:** faste skabeloner (morgenrutine,
   skoletaske, tandbørstning, sengetid), der udfylder den eksisterende
   rutine-editor — se `54_Sprint54_Rutineskabeloner_Plan.md`.
5. **Implementeret i Sprint 55:** oplæsning (isoleret, kun klient-side Web
   Speech API), samlet administrationsside med QR-kode og
   sessionsoverblik for børneadgang, kalenderaftaler i barnets visning
   (sikkert delomfang — se `55_Sprint55_Barn_Adgang_UX_Plan.md`s "Fase
   C — afgrænsning" for hvorfor ægte flerpersoners deltager-matchede
   aftaler stadig mangler), og en minimal, envejs besked-funktion fra
   voksen til barn.
6. Valgfrit point-/mållag oven på lommepenge.
7. Guidede eksterne kalenderforbindelser (Aula/DBU Kampklar/Holdsport) —
   sidst, da det afhænger af ekstern research pr. tjeneste.

Hver fase bør have sin egen sprint-plan (samme mønster som
`01_Project_Documentation/Development/NN_...Plan.md`), verificeret mod
koden før implementering, som resten af projektets arbejdsform.
