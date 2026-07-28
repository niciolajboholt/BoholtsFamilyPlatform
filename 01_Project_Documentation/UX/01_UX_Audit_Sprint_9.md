# UX Audit – Sprint 9

**Projekt:** Boholts Family Platform
**Dato:** 2026-07-28
**Grundlag:** Kodegennemgang af den aktuelle React/Material UI-webapp. Ingen manuel afprøvning på en fysisk enhed er gennemført.

## 1. Formål og scope

Auditten identificerer dokumenterbare UX- og tilgængelighedsforbedringer, der kan opdeles i små Sprint 9-opgaver.

Følgende er gennemgået i koden:

- Kalenderens hovedside, måned- og ugevisning samt navigation.
- Oprettelse, redigering, sletning og fortrydelse af aftaler.
- Loading-, empty-, error- og snackbar-tilstande.
- Formularvalidering, konfliktadvarsler og handlinger under gemning.
- Responsive styles, touch-relaterede størrelser og tastaturhåndtering.
- Dialogernes lukning, semantik, labels og statusfeedback.
- Layout, tema, lokal lagring og den aktuelle PWA-konfiguration.

Følgende kan ikke vurderes sikkert alene ud fra koden:

- Faktisk farvekontrast i alle browsere, systemfarver og skærmprofiler.
- Fokusforløb, scroll-adfærd, tastaturnavigation og touch-præcision i en kørende browser.
- Skærmlæserens faktiske oplæsning af Material UI-komponenter.
- PWA-installation, service worker, offline-cache og opdateringsflow på en fysisk telefon.
- Performance med en realistisk stor kalender og rigtige Google Calendar-data.

## 2. Overordnet vurdering

Kalenderflowet har et godt funktionelt fundament: der er tydelige danske labels, separate opret- og redigeringsdialoger, validering, konfliktadvarsler, loading/empty/error-visning og bekræftelse efter opret, opdater og slet. Material UI giver desuden en del indbygget tastatur- og dialogadfærd.

Den største UX-gæld ligger i beskyttelse af uafsluttet formulararbejde, tilgængelig semantik i kalenderens indlejrede klikflader, den faste startdato og den uafklarede mobile/PWA-oplevelse. Flere forbedringer kan gennemføres isoleret uden at ændre kalenderdomænet.

## 3. Fund

### UX-001 — Uafsluttet formular kan lukkes uden advarsel

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Opret og rediger aftale.
- **Observation:** Begge dialoger kalder `onClose` ved Escape eller klik uden for dialogen, når `isSaving` er falsk. Der findes ingen dirty-state eller bekræftelse ved lukning.
- **Brugerens potentielle problem:** Indtastede ændringer kan gå tabt ved et utilsigtet Escape-tryk, backdrop-klik eller Annuller.
- **Alvorlighed:** Høj
- **Anbefalet forbedring:** Tilføj en lokal dirty-kontrol og en bekræftelsesdialog før lukning, når værdierne er ændret.
- **Berørte filer:** `NewEventDialog.tsx`, `EditEventDialog.tsx` og eventuelt en ny lille bekræftelseskomponent.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Ja, lukning kræver en eksplicit beslutning ved ændrede data.

### UX-002 — Kalenderen åbner på en fast dato

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Første åbning af kalenderen.
- **Observation:** `CalendarPage` initialiserer `selectedDate` med `new Date("2026-07-27T12:00:00")` i stedet for den aktuelle dato.
- **Brugerens potentielle problem:** Brugeren lander potentielt i en gammel uge eller måned og kan overse dagens aftaler.
- **Alvorlighed:** Høj
- **Anbefalet forbedring:** Initialisér kalenderen fra dagens lokale dato med samme middag-normalisering som den øvrige navigation.
- **Berørte filer:** `CalendarPage.tsx`.
- **Forventet implementeringsomfang:** Lille
- **Forventes ændringen at ændre funktionel adfærd:** Ja, startvisningen bliver dynamisk.

### UX-003 — Indlejrede interaktive elementer i kalenderen

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Valg af dag og åbning af event i måned- og ugevisning.
- **Observation:** `DayCell` er en `ButtonBase`, men indeholder event-elementer med `role="button"` og `tabIndex={0}`. I `WeekCalendar` er et dagskort et `component="button"`, som indeholder tilsvarende fokusbare eventkort.
- **Brugerens potentielle problem:** Indlejrede knapper/fokusmål giver ugyldig eller tvetydig HTML-semantik og kan skabe uforudsigelig tastatur- og skærmlæseradfærd.
- **Alvorlighed:** Høj
- **Anbefalet forbedring:** Omstrukturér hvert dagskort, så dato-valg og eventåbning er søskendeinteraktioner eller én klart defineret interaktion; brug semantiske `Button`/`ButtonBase` frem for manuelt `role="button"`.
- **Berørte filer:** `DayCell.tsx`, `WeekCalendar.tsx`.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Ja, interaktionsstrukturen ændres, men ikke kalenderdata.

### UX-004 — Mobile månedsceller viser ejere som farveprikker uden tekst

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Månedsvisning på smalle skærme.
- **Observation:** I `DayCell` skjules antal events på `xs`, og eventtitler skjules under `md`; der vises i stedet op til fem farveprikker. Ejerens navn findes kun i HTML-attributten `title`.
- **Brugerens potentielle problem:** Touch-brugere og brugere, der ikke skelner farver sikkert, får begrænset information om dagens aftaler og ejere. `title` er ikke en tilstrækkelig mobil- eller skærmlæserbeskrivelse.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Giv månedscellen et kort tekstalternativ eller en tilgængelig label med dato og antal aftaler; vurder samtidig en kompakt, tekstbaseret eventindikator til små skærme.
- **Berørte filer:** `DayCell.tsx`, `MonthCalendar.tsx`.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Nej, primært informations- og tilgængelighedsforbedring.

### UX-005 — Flere ugeaftaler kan ikke åbnes direkte

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Ugevisning med mere end tre tidsbestemte aftaler på en dag.
- **Observation:** `WeekCalendar` viser kun de første tre tidsbestemte events og derefter teksten `+ n flere`, som ikke er en handling.
- **Brugerens potentielle problem:** Brugeren kan ikke åbne eller se de skjulte aftaler direkte fra ugevisningen.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Gør tælleren til en tydelig handling, der vælger dagen og flytter fokus/scroll til dagslisten, eller giv adgang til en komplet dagsoversigt.
- **Berørte filer:** `WeekCalendar.tsx`, eventuelt `CalendarPage.tsx`.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Ja, fordi der tilføjes en navigationshandling.

### UX-006 — Valideringsfejl vises før brugerhandling og er ikke feltforankrede

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Ny aftale og redigering.
- **Observation:** Den første valideringskode beregnes straks. I en ny dialog giver tom titel derfor en synlig advarsel og deaktiveret gem-knap før brugeren har interageret. Felterne får ikke `error`, `helperText` eller programmatisk fokus på det fejlende felt.
- **Brugerens potentielle problem:** Tidlig fejlfeedback kan føles afvisende, og brugeren får ikke direkte hjælp til, hvilket felt der skal rettes.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Indfør et submit-/touched-signal for visning af fejl og tilknyt relevante fejl til det konkrete felt med MUI-fejltilstande. Bevar servicevalideringen som sidste sikkerhedsnet.
- **Berørte filer:** `NewEventDialog.tsx`, `EditEventDialog.tsx`, `EventDateTimeSection.tsx`, eventuelt form-hooks.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Ja, tidspunktet for fejlvisning ændres; valideringsreglerne behøver ikke ændres.

### UX-007 — Loading-tilstand har ingen tekstlig status

- **Type:** Sandsynlig risiko
- **Område eller brugerflow:** Første indlæsning af aftaler.
- **Observation:** `EventList` viser kun `CircularProgress` uden synlig tekst eller specifik `aria-label`. Koden viser ikke, om kalenderen stadig indlæser, når brugeren ser måned- eller ugefladen.
- **Brugerens potentielle problem:** Især skærmlæserbrugere og brugere med langsom lagring kan mangle kontekst om, hvorfor aftalelisten er tom eller ufuldstændig.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Tilføj en dansk tekstlig loading-status og verificér annoncering med skærmlæser; overvej et samlet loading-lag for kalender og dagsliste.
- **Berørte filer:** `EventList.tsx`, eventuelt `CalendarPage.tsx`.
- **Forventet implementeringsomfang:** Lille
- **Forventes ændringen at ændre funktionel adfærd:** Nej.

### UX-008 — Indlæsningsfejl kan ikke genforsøges fra UI

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Fejl ved hentning af kalenderdata.
- **Observation:** `useCalendarEvents` eksponerer `refreshEvents`, men `CalendarPage` sender den ikke til `EventList`. Fejlvisningen består kun af en `Alert` uden genindlæsningshandling.
- **Brugerens potentielle problem:** Brugeren skal selv navigere væk eller genindlæse siden for at prøve igen.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Tilføj en tydelig `Prøv igen`-handling i fejltilstanden, der kalder `refreshEvents` og viser status under forsøget.
- **Berørte filer:** `CalendarPage.tsx`, `EventList.tsx`.
- **Forventet implementeringsomfang:** Lille
- **Forventes ændringen at ændre funktionel adfærd:** Ja, der tilføjes manuel genindlæsning.

### UX-009 — Hurtig handling lover mere end den udfører

- **Type:** Dokumenteret problem
- **Område eller brugerflow:** Forsiden, Hurtige handlinger.
- **Observation:** Handlingen `Ny aftale` navigerer til `/calendar`, men åbner ikke oprettelsesdialogen. De to øvrige handlinger (`Indkøbsliste` og `Opgaver`) har ingen handling.
- **Brugerens potentielle problem:** Et tryk kan opleves som uden resultat eller som en ufuldstændig genvej.
- **Alvorlighed:** Lav
- **Anbefalet forbedring:** Åbn oprettelsesflowet direkte eller omdøb handlingen til `Åbn kalender`; markér eller fjern ikke-implementerede handlinger indtil de virker.
- **Berørte filer:** `HomePage.tsx`, eventuelt `CalendarPage.tsx` og routing.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Ja.

### UX-010 — Global template-CSS kan modarbejde MUI-layout og tema

- **Type:** Sandsynlig risiko
- **Område eller brugerflow:** Hele appen, især smal visning og systemets mørke tema.
- **Observation:** `index.css` sætter blandt andet `#root` til 1126 px med kantlinjer og centrering, `text-align: center` samt `color-scheme: light dark` og egne mørke CSS-variabler. Appens MUI-tema er derimod fast `light`, og `App`/`AppLayout` tilføjer yderligere containere.
- **Brugerens potentielle problem:** Systemets mørke native kontroller, arvet tekstjustering eller ekstra indramning kan give et inkonsistent layout, som ikke er synligt ved kildegennemgang alene.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Foretag visuel regressionstest og reducer template-styles til et bevidst app-reset, der stemmer overens med MUI-temaet.
- **Berørte filer:** `index.css`, `App.tsx`, `AppLayout.tsx`, `theme.ts`.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Nej, men visuel adfærd ændres.

### UX-011 — PWA/offline-installation er ikke konfigureret

- **Type:** Dokumenteret status / produkt-risiko
- **Område eller brugerflow:** Installation og offline-oplevelse.
- **Observation:** `vite-plugin-pwa` findes i `package.json`, men `vite.config.ts` registrerer kun React-pluginet. Der er ingen manifest- eller service-worker-konfiguration i den gennemgåede kode. Aftaler gemmes lokalt i `localStorage`, men det er ikke det samme som installerbar/offline-cachet PWA.
- **Brugerens potentielle problem:** Brugeren kan ikke forvente installerbar app, offline shell eller kontrolleret opdateringsflow endnu.
- **Alvorlighed:** Mellem
- **Anbefalet forbedring:** Aftal først PWA-scope og tilføj derefter manifest, service worker, offline-fallback og opdateringskommunikation som en selvstændig feature.
- **Berørte filer:** `vite.config.ts`, `package.json`, `public/`, eventuelt layout og dokumentation.
- **Forventet implementeringsomfang:** Stor
- **Forventes ændringen at ændre funktionel adfærd:** Ja.

### UX-012 — Farve bruges som fremtrædende ejerindikator

- **Type:** Forslag til polish med tilgængelighedsrisiko
- **Område eller brugerflow:** Kalenderceller, eventkort og ejerfiltre.
- **Observation:** Ejere kommunikeres ofte via farvede prikker, venstrekant eller baggrundsfarve. Der findes tekstlabels i mange, men ikke alle, visninger; månedens farveprikker har kun `title`.
- **Brugerens potentielle problem:** Farveblinde brugere eller brugere i dårlige lysforhold kan få et svagere ejer-overblik.
- **Alvorlighed:** Lav
- **Anbefalet forbedring:** Bevar farver som sekundært signal og tilføj korte tekstlige eller semantiske ejerbeskrivelser, hvor kun farveprikker vises.
- **Berørte filer:** `DayCell.tsx`, `MonthCalendar.tsx`, `WeekCalendar.tsx`, `EventList.tsx`.
- **Forventet implementeringsomfang:** Mellem
- **Forventes ændringen at ændre funktionel adfærd:** Nej.

## 4. Tilgængelighed

Koden indeholder flere gode grundelementer: native MUI-knapper, labels på tekstfelter, `aria-label` på centrale ikonhandlinger, fokusstil på de manuelt tastaturaktiverede eventkort og MUI-dialoger med `autoFocus` på titelfeltet.

Der er dog konkrete forhold at prioritere:

- **Tastatur og semantik:** UX-003 er den vigtigste fejl. Fokusbare eventkort må ikke ligge inde i en dag-knap.
- **Fokus:** Fokus ved åbning/lukning af Material UI-dialoger bør testes manuelt. Koden angiver ikke et eksplicit fokusmål efter succesfuld create, update eller delete.
- **Labels og formularfejl:** Formularfelterne har labels, men UX-006 mangler feltforankret fejltilstand og styring af hvornår fejl annonceres.
- **Dialoger:** Lukning er blokeret under gemning, og knapper er deaktiverede. UX-001 mangler derimod beskyttelse mod at lukke et ændret udkast.
- **Farve:** Ejerfarver suppleres ofte af tekst, men ikke i den mobile månedscelle (UX-004 og UX-012).
- **Statusbeskeder:** Snackbarer og Alerts kommer fra Material UI, men faktisk skærmlæserannoncering og timing skal testes. Loading-indikatoren mangler synlig kontekst (UX-007).

Auditten erklærer ikke WCAG-overholdelse; den er baseret på statisk kodegennemgang, ikke kontrastmåling eller assistiv teknologitest.

## 5. Mobil og PWA

### Direkte vurderbart fra responsive styles

- Kalenderhovedet går fra række til kolonne på små skærme, og ugevisningen går fra syv kolonner til én kolonne ved `md`.
- Månedsceller reduceres til mindst 72 px på `xs`; eventtitler skjules under `md`, hvilket udløser UX-004.
- Den faste bundnavigation har 68 px højde og layoutet reserverer bundplads med `pb: 10`.
- Dato-/tidssektionen bruger et responsivt grid med én kolonne på `xs` og to på `sm`.

### Kræver manuel test

- Om 72 px månedsceller giver tilstrækkelige og adskilte touch-mål med reelle eventmængder.
- Om den faste bundnavigation dækker indhold eller snackbars ved Safari safe areas.
- Om dialoger, tastatur og automatisk scroll fungerer på iPhone.
- Om MUI-fokus, native date/time-inputs og systemets mørke tilstand virker konsistent med `index.css`.

PWA er ikke implementeret i den gennemgåede Vite-konfiguration. `localStorage` giver lokal eventlagring, men dokumenterer ikke en installerbar eller cachet offlineoplevelse.

## 6. Prioriteret Sprint 9-backlog

| Prioritet | Fund-ID | Kort titel | Brugerfordel | Risiko | Estimeret størrelse | Foreslået del-sprint |
|---|---|---|---|---|---|---|
| 1 | UX-001 | Beskyt uafsluttede formularer | Forebygger tab af indtastede aftaler | Høj | Mellem | Sprint 9.2 |
| 2 | UX-003 | Fjern indlejrede interaktioner | Forudsigelig tastatur- og skærmlæserbrug | Høj | Mellem | Sprint 9.3 |
| 3 | UX-002 | Start på dagens dato | Giver relevant kalender ved åbning | Høj | Lille | Sprint 9.3 |
| 4 | UX-006 | Feltforankret validering | Gør fejl lettere at forstå og rette | Mellem | Mellem | Sprint 9.4 |
| 5 | UX-008 | Tilføj Prøv igen ved indlæsningsfejl | Giver vej ud af en fejltilstand | Mellem | Lille | Sprint 9.4 |
| 6 | UX-004 | Forbedr mobil månedscelle | Bedre forståelse uden farve alene | Mellem | Mellem | Sprint 9.5 |
| 7 | UX-005 | Gør skjulte ugeaftaler tilgængelige | Alle aftaler kan åbnes | Mellem | Mellem | Sprint 9.5 |
| 8 | UX-007 | Gør loadingstatus tekstlig | Bedre status for alle brugere | Lav | Lille | Sprint 9.4 |
| 9 | UX-010 | Ryd op i global template-CSS | Mere stabil mobil- og temavisning | Mellem | Mellem | Sprint 9.6 |
| 10 | UX-009 | Ret hurtige handlinger | Mindre forvirring på forsiden | Lav | Mellem | Sprint 9.6 |
| 11 | UX-012 | Supplér ejerfarver med tekst | Bedre farveuafhængigt overblik | Lav | Mellem | Sprint 9.5 |
| 12 | UX-011 | Aftal og implementér PWA-scope | Tydelig offline-/installationsoplevelse | Mellem | Stor | Separat feature efter Sprint 9 |

### Tematisk opdeling

- **Sprint 9.2 — Sikker formularlukning:** UX-001.
- **Sprint 9.3 — Sikker kalenderinteraktion:** UX-003 og UX-002.
- **Sprint 9.4 — Tydelig status og validering:** UX-006, UX-008 og UX-007.
- **Sprint 9.5 — Mobil kalenderforståelse:** UX-004, UX-005 og UX-012.
- **Sprint 9.6 — Forventningsafstemning og visuel basis:** UX-009 og UX-010.
- **Senere feature — PWA:** UX-011 efter konkret produktbeslutning og manuel testplan.

## 7. Anbefalet første implementering

**Sprint 9.2: Beskyt uafsluttede formularer (UX-001).**

Den bør komme først, fordi den direkte beskytter brugerens indtastede data og kan afgrænses til opret- og redigeringsflowet uden ændring af kalenderens datamodel.

- **Sandsynligt berørte filer:** `NewEventDialog.tsx`, `EditEventDialog.tsx`, eventuelt `useEventFormState.ts` og en lille bekræftelsesdialog.
- **Funktionelle risici:** En forkert dirty-sammenligning kan give unødige advarsler, undlade at advare ved ændringer eller blokere legitim lukning efter succesfuld gemning. Eksterne, skrivebeskyttede events må ikke få en meningsløs advarsel.
- **Test:** Opret og redigér både heldags- og tidsbestemte aftaler; ændr og luk via Annuller, Escape og backdrop; bekræft både `Bliv` og `Forkast`; gem og kontrollér, at dialogen lukker uden ekstra prompt; test med tastatur og smal mobilvisning.

## 8. Punkter der kræver manuel test

### Windows-browser

- [ ] Åbn måned og uge med tastatur alene; kontrollér rækkefølge, synlig fokus og aktivering med Enter/Mellemrum.
- [ ] Åbn et event fra måned og uge; verificér at dagvalg og eventåbning ikke konkurrerer.
- [ ] Åbn/luk begge dialoger med Escape, backdrop og Annuller; kontrollér fokusretur til udløsende element.
- [ ] Udløs create-, update-, delete-, undo- og indlæsningsfejl; kontrollér snackbar/Alert og `Prøv igen`, når den er implementeret.
- [ ] Aktivér systemets mørke tema og sammenlign native kontroller med MUI-overfladen.

### Smal mobilvisning i browserens udviklerværktøjer

- [ ] Kontrollér månedsceller med 0, 1, 2 og mange aftaler samt ejerfarver.
- [ ] Kontrollér at alle kalenderkontroller, chips, knapper og bundnavigation kan rammes uden overlap.
- [ ] Kontrollér ugevisningens en-kolonne-layout, `+ n flere` og scroll til dagsliste.
- [ ] Kontrollér dialogbredde, date/time-inputs, scroll og tastaturdækning.
- [ ] Kontrollér at snackbar og bundnavigation ikke dækker primære handlinger.

### Fysisk iPhone, hvor relevant

- [ ] Test touch-mål, safe areas, Safari date/time-inputs og dialogscroll.
- [ ] Test VoiceOver på bundnavigation, månedsceller, ugeevents, Alerts og dialogfejl.
- [ ] Test systemets tekstforstørrelse og høj kontrast.
- [ ] Test installation/offline først efter PWA-konfiguration; den er ikke implementeret nu.
