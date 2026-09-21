# 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan

Version: 1.0

Project:
Boholts Family Platform (Hjemmecentralen)

Last Updated:
2026-09-20

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Implementeret 2026-09-20 (afsnit A-J). Afventer fuld VERIFY-kørsel og
Nicolajs gennemgang/godkendelse før merge til `develop` — se PR'en for
testresultater.

---

## Formål

Sprint 51–56 byggede "Mit i dag", børneadgang (PIN, link, QR, sessioner,
beskeder) og en voksende mængde valgfrie funktioner (feature flags). Sprint
57 tilføjer ingen nye hovedfunktioner — den retter sammenhæng, ydelse og
UX-gæld, der er opstået undervejs: børneadgang der fejlagtigt tilbydes til
voksne, featureflag uden afhængighedsregler, forsidens genveje der ignorerer
feature flags, en kalender der henter tre års data uanset hvilken visning
der reelt vises, dobbelte netværkskald, en kalender der ikke bruger sin
tiltænkte bredde på desktop, og en Indstillinger-side der er vokset sig for
lang.

---

## EXPLORE — bekræftede fund

### 0. Kritisk forudsætning: arbejdsgrenen skal være baseret på `develop`, ikke `main`

Den tildelte branch (`claude/sprint-57-coherence-speed-ux-frn9pf`) var
oprindeligt oprettet fra `origin/main` (stale, stopper ved Sprint 37 i
CHANGELOG). PR #258/Sprint 56, "Mit i dag", børneadgang, rutineskabeloner
mv. findes kun på `origin/develop` (~19 sprints foran `main`, se
`PROJECT_STATUS.md` på develop, opdateret 2026-09-19). Branchen er rebygget
fra `origin/develop` (`git checkout -B ... origin/develop`) — de 93
"nye" commits, der nu er lokalt, er reelt allerede eksisterende,
mergede develop-historik, ikke nyt arbejde. Den fjerne
`claude/sprint-57-coherence-speed-ux-frn9pf`-branch indeholder ingen unikke
commits ud over `main` og kan derfor sikkert genskrives til at pege på
`develop`'s historik uden tab af noget arbejde — dette kræver dog et
force-with-lease-push, som er blokeret af sessionens auto-mode-klassifikator
og derfor kræver Nicolajs eksplicitte godkendelse ved commit-fasen.

### A. Børneadgang (Mit i dag / ChildAccessAdminPanel)

- `MitIDagPage.tsx:178` filtrerer kun familie-pseudoprofilen fra
  (`relation !== null`) — enhver anden profil ("Far", "Mor", "Barn",
  "Andet") kan vælges i medlemsvælgeren.
- `MitIDagPage.tsx:409-429`: Accordion'en med "Børneadgang for {navn}" og
  `ChildAccessAdminPanel` vises for ENHVER valgt profil, så snart den
  loggede bruger selv er ejer/admin — der tjekkes intet på
  `selectedMember.relation`.
- `MitIDagPage.tsx:382-407`: "Beskeder"-sektionen vises altid, uanset hvem
  der er valgt.
- `ChildAccessAdminPanel.tsx` validerer heller ikke internt, at det
  medlem, den får som prop, er et barn.
- **Server-side hul** (det centrale sikkerhedsproblem): både
  `childAccessManagement.ts:23-37`s `requireOwnerOrAdminMember()` og
  `childMessages.ts:20-27`s `isRealFamilyMember()` bruger
  `relation IS NOT NULL` — det udelukker kun familie-pseudoprofilen
  (`relation = NULL`), IKKE voksne (`relation IN ('Far','Mor','Andet')`).
  En ejer/admin kan i dag aktivere børneadgangs-link, sætte PIN og
  administrere "børnesessioner" for en hvilken som helst voksen via
  disse ruter — direkte API-kald medregnet, ikke kun via UI'et.
- Canonisk datamodel: `family_members.relation` (fri TEXT, migration
  0003) er det eneste felt, der skelner børn fra voksne. Ingen
  `is_child`-boolean findes. Klientens dropdown begrænser værdier til
  `["Far","Mor","Barn","Andet"]`
  (`src/features/calendar/data/familyMemberRelations.ts`), men **denne
  liste håndhæves ikke server-side** — `familyMembers.ts`s POST/PATCH
  gemmer `body.relation` uden validering.
- `child_access_token`/`pin_hash`/`pin_set_at` (migration 0032) og
  `child_sessions`/`child_messages` (migration 0033) er allerede
  eksisterende, fungerende tabeller — ingen ny migration er nødvendig for
  at rette adgangskontrollen; problemet er applikationslogik, ikke skema.
- Eksisterende tests (`childAccessManagement.test.ts`,
  `childAccess.test.ts`) sår altid børn med `relation = 'Barn'` og
  tester kun afvisning af familie-pseudoprofilen — **ingen test dækker i
  dag afvisning af en voksen profil**, hvilket bekræfter at fejlen er
  reel og upåagtet.

**Beslutning:** brug `relation === 'Barn'` konsekvent som "er dette en
børneprofil"-signalet, både klient- og serverside, OG tilføj
server-side allow-list-validering af `relation` på
`POST/PATCH /:id/members` (samme mønster som `isKnownFeatureKey` for
feature flags) — så `relation` bliver et reelt, håndhævet kategorisk felt
i stedet for fri tekst. Dette undgår en ny D1-migration, samtidig med at
det opfylder kravet om ikke at basere sikkerhedslogik på en vilkårlig
brugerrettet streng.

### B. Feature flags og afhængigheder

- 9 flag findes: `shopping-list`, `tasks`, `routines`, `meal-plan`,
  `task-rewards`, `birthdays`, `shared-expenses`, `kiosk`, `mit-i-dag`
  (`featureFlags.ts:18-28`, dupliceret i `FeatureFlagsDialog.tsx:38-102`).
- Lagring: tilstedeværelse af en række i `family_enabled_features`
  (migration 0027) — ingen boolean-kolonne, ingen `CHECK`-constraint på
  `feature_key`.
- **Ingen afhængighedsvalidering findes i dag**, hverken klient- eller
  serverside. `featureFlags.ts:58-91`s PUT-rute validerer kun rolle
  (ejer/admin) og at nøglen er kendt — intet tjek på andre aktiverede
  flag.
- Kun 3 tests findes (`families.test.ts:2592-2703`) — alle enkelt-flag,
  rolle eller ukendt-nøgle. Ingen test dækker kombinationslogik.

**Beslutning:** løs det udelukkende server-side, atomisk, i samme D1
`batch()`-kald som selve skriveoperationen (ingen ny migration
nødvendig — `family_enabled_features` understøtter allerede vilkårlige
kombinationer af rækker):

- En fast afhængighedstabel i kode:
  `{ routines: "tasks", "task-rewards": "tasks" }`.
- Aktivering af `routines`/`task-rewards`: indsæt også `tasks`, hvis den
  ikke allerede er aktiv (samme batch).
- Deaktivering af `tasks`: fjern også `routines`/`task-rewards`, hvis de
  er aktive (samme batch) — "deaktivering håndterer underfunktionerne
  forståeligt" tolkes som en klar, synlig kaskade (afspejlet med det
  samme i UI'et via den allerede eksisterende
  `enabledFeaturesChangedEvent`), ikke en stiltiende blokering.
- **Normalisering af allerede gemt ugyldig tilstand:** `GET
  /:id/enabled-features` kører samme "tilføj manglende `tasks`, hvis en
  underfunktion er aktiv"-logik ved hver læsning, før den returnerer
  listen — en familie, der (før denne rettelse) fik `routines` aktiveret
  uden `tasks`, får `tasks` tilføjet automatisk ved næste hentning, i
  stedet for at miste `routines`. Ingen bruger mister noget, de aktivt
  har slået til.
- `FeatureFlagsDialog.tsx`: udvid beskrivelsesteksterne for `routines` og
  `task-rewards` til eksplicit at nævne, at Opgaver aktiveres automatisk;
  udvid `tasks`' beskrivelse til at nævne, at Rutiner/Opgave-belønning
  slås fra, hvis de er aktive.
- Da PUT allerede returnerer hele det opdaterede sæt, og
  `useEnabledFeatures.toggle()` allerede udsender
  `enabledFeaturesChangedEvent` med netop dette sæt (lyttet til af
  `AppLayout`s egen hook-instans, `useEnabledFeatures.ts:70-78`), kræver
  "andre familiemedlemmers navigation opdateres korrekt" ingen ny
  klientkode — mekanismen findes allerede og virker korrekt, når
  serveren returnerer det fulde, kaskade-korrigerede sæt.

### C. Hurtige handlinger

- `HomePage.tsx:51-55`: `quickActions` er en statisk liste uden nogen
  feature-flag-reference. "Indkøbsliste" og "Opgaver" navigerer direkte
  til `/shopping-list`/`/tasks` (linje 444-456), uanset om
  `shopping-list`/`tasks` er slået fra — selvom `AppLayout.tsx:60,62`
  allerede skjuler de tilsvarende nav-punkter, når flagget er fra.
- "Ny aftale" har ingen tilknyttet flag (kalenderen er en kernefunktion).

**Beslutning:** filtrér `quickActions` med samme `useEnabledFeatures()`
-mønster som `AppLayout` allerede bruger til navigation — skjul en
handling, hvis dens flag er fra, i stedet for at vise den deaktiveret.
Dette er den mindst overraskende løsning: en handling, der ikke findes i
navigationen, bør heller ikke findes som en klikbar genvej på forsiden.
"Ny aftale" har intet flag og vises altid.

### D. Kalenderens datointervaller

- `getDefaultCalendarEventRange()` (`calendarProvider.ts:83-96`) beregner
  "nu − 1 år til nu + 2 år" og er **eneste kaldested**:
  `useCalendarEvents.ts:105` kalder den uden argumenter ved hvert mount —
  bruges uændret af `HomePage`, `MitIDagPage` og `CalendarPage` (via
  `useCalendarPageController`), uanset hvilket vindue den enkelte side
  reelt behøver.
- `CompositeCalendarProvider.getEvents(range)` sender `range` videre
  uændret til hver af de fire eksterne providere (Google, Outlook,
  iCloud, ICS) — parameteren er allerede kablet igennem hele vejen; det
  er kun kaldestedet i `useCalendarEvents` der ikke bruger den.
- `getVisibleRange()` (`calendarPageDateNavigation.ts:77-131`) findes
  allerede og bruges i dag udelukkende til at afgrænse
  gentagelses-udfoldning (`expandRecurringEvents`) af det allerede
  (bredt) hentede datasæt — IKKE til selve hentningen. Den beregner
  fornuftige, allerede-eksisterende buffer-vinduer pr. visning:
  - uge: 7 dage før til 14 dage efter `visibleDate`.
  - dag: 3 dage før til 4 dage efter `visibleDate`.
  - måned: 7 dage buffer omkring månedens første/sidste dag (dækker
    månedsgittens synlige nabo-uger, jf. `getCalendarMonth()`s faste
    42-dages gitter).
- Familie-/planlægger-visningen (`FamilyPlannerCalendar.tsx`) har sit
  eget, uafhængigt, dynamisk voksende vindue
  (`plannerWindowReducer.ts`): start ±6 uger, udvides i 4-ugers bidder,
  hårdt loft på 120 uger — denne visning må IKKE ændres, den henter
  allerede kun det, den behøver, blot fra det (i dag for brede) samlede
  events-datasæt.
- **Rækkevidde-sikkerhed pr. udbyder — verificeret eksplicit pr. udbyder
  (kode læst, ikke antaget):**
  - **Outlook**: `/calendarView` (`OutlookCalendarApi.ts:61-76`) udfolder
    gentagne serier server-side og filtrerer korrekt med overlap-semantik
    (en flerdagesaftale, der starter før intervallet, medtages fortsat).
    **Sikkert og fuldt effektivt at indsnævre.**
  - **ICS-abonnementer**: `icsCalendar.ts:209-282` udfolder RRULE
    server-side via `ical.js`s `iterator()`/`getOccurrenceDetails()` med
    korrekt overlap-filtrering (linje 248-249, 267) og et loft på 500
    forekomster pr. aftale. **Sikkert og effektivt at indsnævre** — eneste
    forbehold er `IcsCalendarProvider`s 15-minutters cache
    (`ICS_REFRESH_TTL_MS`), som er nøglet pr. abonnement, ikke pr.
    interval, og derfor kan returnere et resultat hentet under et andet
    (bredere) interval i op til 15 minutter. Acceptabelt — ikke en
    korrekthedsfejl, kun en kort forsinkelse før et nyt, snævrere kald
    reelt når serveren.
  - **Google — [RETTET efter Nicolajs review, se afsnittet "Risici" og
    commitindlægget for den konkrete rettelse].** Oprindelig (fejlagtig)
    vurdering her: `GoogleCalendarApi.listEvents` bruger korrekt
    `timeMin`/`timeMax`/`singleEvents=true` ved første synkronisering,
    men et cachet `syncToken` fik `GoogleCalendarProvider`
    (`GoogleCalendarProvider.ts`) til at ignorere `range` fuldstændigt
    ved efterfølgende kald, og det blev fejlagtigt vurderet som
    "harmløst" — men fordi cachen kun var opbygget for det interval, den
    FØRSTE fulde synk dækkede, kunne en efterfølgende, bredere
    forespørgsel reelt gå glip af aftaler uden for det oprindelige
    interval (en funktionel fejl, ikke kun en udeblevet
    ydelsesgevinst — se Risici). `GoogleCalendarSyncCacheState` gemmer
    nu det dækkede interval eksplicit, og en forespørgsel uden for det
    udløser en ny, intervalbaseret fuld synk (unionen af gammelt og nyt
    interval), før syncToken-genbrug igen tillades.
  - **iCloud/CalDAV**: `icloudCalDav.ts` sender korrekt et CalDAV
    `<c:time-range>`-filter (linje 333-335, overlap-korrekt per RFC 4791)
    — men **udfolder aldrig RRULE-gentagelser overhovedet** (ingen
    `isRecurring()`/`iterator()`/`RecurExpansion` findes i filen). En
    gentagen mesteraftale returneres som ÉN forekomst, dateret til sin
    egen (evt. årgamle) startdato — ikke til den forekomst, der reelt
    ligger i det forespurgte interval. Filens egen kommentar (linje
    19-23) bekræfter, at denne kode **"ikke er afprøvet mod en rigtig
    iCloud-konto endnu"**. **Dette er en allerede eksisterende fejl,
    uafhængig af denne sprint** — den findes lige så meget under det
    nuværende 3-årige vindue. At indsnævre intervallet gør den
    eksisterende fejl mere synlig (en gentagen iCloud-aftale med gammel
    startdato forsvinder oftere fra et snævrere vindue), men skaber ikke
    selve fejlen. Ikke-gentagne fler­dagesaftaler fra iCloud er upåvirkede
    (overlap-filteret er korrekt for dem).
  - `event.recurrence` (feltet `expandRecurringEvents.ts` læser) sættes i
    praksis ALDRIG af nogen af de fire udbyderes klient-mappere i dag
    (bekræftet ved læsning af alle fire mapper-filer) — kun skrevet af
    Googles egen opret/redigér-dialog client-side, aldrig af nogen
    læse-vej. `expandRecurringEvents()` er dermed reelt dødt/inaktivt i
    produktion i dag, en eksisterende tilstand fra før ADR-017 fjernede
    det lokale kalenderlag — uafhængigt af og upåvirket af denne sprints
    intervalændringer.

**Beslutning (revideret efter udbyder-verifikation):**

- `useCalendarEvents(provider, range?)` udvides til at acceptere en
  valgfri `range`-parameter (default bevares som
  `getDefaultCalendarEventRange()` for bagudkompatibilitet med
  kaldesteder, der ikke er ændret).
- **Mit i dag**: henter kun `[start of today − 1 dag, start of morgen +
  1 dag]` (dagens vindue plus én dags buffer på hver side, for korrekt at
  fange flerdagesaftaler, der er i gang) — IKKE et helt års data for en
  side, der kun viser én dag.
- **Overblik (HomePage)**: henter `[nu, nu + 14 dage]` (matcher det
  eksisterende `dashboardLookaheadDays`, som i dag kun bruges til
  client-side filtrering af et allerede 3-årigt datasæt).
- **Måned/uge/dag (CalendarPage)**: bruger `getVisibleRange()`s
  allerede-eksisterende, view-specifikke vinduer som selve
  fetch-intervallet (ikke kun til udfoldning) — disse vinduer har i
  forvejen en rundhåndet buffer (7 dage for måned, hhv. 7/14 og 3/4 dage
  for uge/dag), hvilket er tilstrækkeligt for Outlook/ICS's bekræftede
  overlap-korrekte filtrering.
- **Familie-/planlægger-visning**: uændret, også i selve fetch-kaldet.
  Planlæggerens rullende vindue-tilstand lever inde i
  `FamilyPlannerCalendar`-komponenten selv (`useReducer`), ikke i
  `useCalendarPageController`, som er der, hvor selve
  `useCalendarEvents`-kaldet sker — at løfte vinduestilstanden op i
  controlleren for at kunne bruge den som fetch-range ville være et
  strukturelt indgreb i en komponent, opgaven eksplicit beder om at lade
  være urørt. `useCalendarPageController` sender derfor `undefined`
  (dvs. det uændrede, brede standardinterval) som fetch-range, når
  `calendarView === "planner"`, og først den view-specifikke, snævrere
  `getVisibleRange()`-baserede range for måned/uge/dag. Dette er en
  bevidst, dokumenteret afgrænsning af ydelsesgevinsten for
  planlæggervisningen specifikt — dens korrekthed er uændret, kun dens
  eventuelle ydelsesgevinst er udskudt til en fremtidig sprint, der kan
  gennemføre den nødvendige strukturændring med sin egen risikovurdering.
- Al eksisterende dedup (`deduplicateCalendarEvents`, kører på det rå,
  hentede datasæt før view-specifik filtrering) og privatlivsredigering
  (`redactCalendarEventForViewer`, kører på master-aftaler, ikke pr.
  forekomst) forbliver uændret — begge er intervalneutrale.
- **Bevidst UDENFOR denne sprints omfang** (dokumenteres ærligt som kendt
  begrænsning, ikke stiltiende løst): at tilføje RRULE-udfoldning til
  `icloudCalDav.ts` (Googles syncToken-cache ER nu rettet til at
  respektere et indsnævret interval — se ovenfor og Risici — det var
  oprindeligt fejlagtigt placeret i denne kategori). iCloud-udfoldningen
  er en reel, men afgrænset, allerede eksisterende arkitekturbegrænsning
  opdaget under denne sprints EXPLORE-fase — ikke introduceret af
  intervalændringen, og for risikabel/omfangsrig at rette som en
  bi-ændring i en sprint, der eksplicit skal reducere risiko, ikke øge
  den. De flages til Nicolaj i CHANGELOG/PR-beskrivelsen som fund, der
  kræver en selvstændig, fremtidig sprint.

### E. Dobbelte netværkskald / delt cache

- `getMyFamily()` (`familyApi.ts:50`) har **ingen cache** og kaldes fra
  20+ steder. På en enkelt Overblik-/Mit i dag-indlæsning gennem
  `AppLayout` sker mindst 4 uafhængige `/api/families/mine`-kald
  (AppLayout selv, `useEnabledFeatures`, `useFamilyMembers`,
  `useCurrentMember`), fordi hver hook ejer sin egen `useState`/
  `useEffect`-hentning uden deling.
- Ingen delt state-platform findes (`grep` bekræfter: intet
  React Query/SWR/Zustand/Redux i `package.json` eller kodebasen) — kun
  ét eksisterende Context (`ThemeModeContext`, urelateret).
- Det eneste eksisterende delings-mønster i kodebasen er "modul-niveau
  cache + `CustomEvent`-broadcast ved ændring" (fx
  `enabledFeaturesChangedEvent` i `useEnabledFeatures.ts`,
  `familyMembersChangedEvent` i `familyMembersStorage.ts`).

**Beslutning:** genbrug det eksisterende mønster i stedet for at
introducere et nyt state-bibliotek (undgår "stor ny tredjepartsafhængighed"
og "omfattende ny state-management-platform", begge eksplicit
udelukket). Ny, lille, afgrænset modul:
`src/features/family/familySessionCache.ts` — et modul-niveau cache-objekt
med:

- `getCachedFamily()`: returnerer et already-in-flight/allerede-opløst
  `Promise<FamilyResponse>` for `getMyFamily()`, dedupliceret pr.
  session (flere samtidige kaldere inden for samme "tick" deler ét
  faktisk `fetch`-kald); en kort TTL (fx 30 sekunder) forhindrer
  permanent forældet data uden at kræve en fuld invalideringsgraf.
  Enhver mutation, der ændrer familien/medlemmer/roller (allerede
  eksisterende steder: `syncFamilyMembersFromServer`,
  `familyMembers.ts`-mutationer osv.), kalder en eksporteret
  `invalidateFamilyCache()` — samme eksplicitte
  "ryd-cache-ved-mutation"-mønster som allerede bruges til
  `familyMembersChangedEvent`.
- `useEnabledFeatures`, `useFamilyMembers`, `useCurrentMember` og
  `AppLayout` migreres til at kalde `getCachedFamily()` i stedet for
  `getMyFamily()` direkte — ingen ændring af deres offentlige
  hook-kontrakt (samme returtype, samme loading/error-semantik), kun af
  hvor data kommer fra.
- Samme TTL+dedup-mønster tilføjes for `useCalendarSources()`
  (`getCalendars()`-resultatet), da flere sider monterer denne hook
  parallelt.
- Kalenderaftaler (`useCalendarEvents`) caches bevidst IKKE i dette
  generiske lag — forskellige sider beder nu (efter punkt D) om reelt
  forskellige intervaller, og en forkert delt cache her er en langt
  større risiko for at vise forældet/forkert data end den ydelsesgevinst,
  den ville give. Den eksisterende `requestGenerationRef`-baserede
  race-beskyttelse i `useCalendarEvents` er tilstrækkelig for nu.

### F. Progressiv indlæsning

- `MitIDagPage.tsx:261-271`: én samlet `if (areCalendarEventsLoading ||
  areTasksLoading) return <CircularProgress/>` blokerer HELE sidens
  indhold, selvom opgaver og kalender hentes uafhængigt af hinanden.
- `calendarError`/`taskError` håndteres allerede pænt som separate,
  ikke-blokerende `Alert`-bokse (linje 279-289) — men kun EFTER at den
  fælles loading-spærre er passeret, dvs. hvis kalenderen er langsom,
  ser brugeren intet, heller ikke allerede hentede opgaver.

**Beslutning:** fjern den fælles tidlige `return`. Lad siden altid
rendere sin struktur (medlemsvælger, "Næste", "Resten af dagen",
"Beskeder"), og vis en kompakt, lokal skeleton/spinner kun for den
sektion, hvis data endnu ikke er klar (kalenderdelen af "Næste"/"Resten
af dagen" uafhængigt af opgavedelen). Eksisterende fejl-/retry-/
offline-beskeder (linje 279-297) bevares uændret. Samme princip
anvendes ikke yderligere på `HomePage`, da dens nuværende hooks allerede
kører parallelt uden en fælles blokerende spærre — der er intet at
progressivt indlæse derudover.

### G. Kalenderens desktopbredde

- `CalendarPage.tsx:43` sætter `maxWidth: 1200` på sin egen `Box`, men
  denne er indlejret i `AppLayout.tsx:382-393`s fælles
  `<Container maxWidth="md">`, som MUI begrænser til 900px (standard
  breakpoints, ingen override fundet i temaet) — den ydre container
  vinder altid over den indre `Box`'s 1200px, så kalenderen reelt aldrig
  bliver bredere end ~900px på skærme ≥900px.
- `HomePage.tsx:184` og `SettingsPage.tsx:13` sætter begge selv
  `maxWidth: 900` — allerede i overensstemmelse med den fælles
  container og upåvirket af en ændring, der kun retter kalenderen.

**Beslutning:** gør den fælles `Container`s `maxWidth` betinget af den
aktuelle rute i `AppLayout.tsx` (`maxWidth={location.pathname ===
"/calendar" ? "xl" : "md"}` — MUI's `xl` er 1536px, rigeligt til at
`CalendarPage`s egen indre `maxWidth: 1200` bliver den reelt
begrænsende faktor, som koden allerede antog den var). Ingen anden side
ændrer bredde, da de alle allerede selv angiver `900`.

### H. Kalenderfilter ("Vis kalendere")

- `CalendarSourceFilter.tsx:75-127`: flad `FormGroup row`-liste, ingen
  gruppering, ingen sammenfoldning. "Vis alle" findes allerede (linje
  70-72). Hver kildes visningsfarver kommer fra
  `getCalendarSourceDisplayColors()` (medlems-farve-mapping bevares
  uændret).
- Typisk kildeantal: Google (evt. flere kalendere pr. konto) + Outlook
  (hvis konfigureret) + iCloud pr. forbundet medlem + ICS-abonnementer —
  realistisk 5-17 kilder for en aktiv familie, hvilket matcher
  opgavebeskrivelsens eksempel "12 af 17 kalendere vises".

**Beslutning:** grupér efter `CalendarOwner`/medlem (data findes
allerede via `members`-prop og `getCalendarSourceDisplayColors`), med en
sammenfoldelig, lukket-som-standard sektion pr. medlem (og en
"Fælles/andet"-gruppe for kilder uden entydig medlems-ejer, fx delte
ICS-abonnementer). Header viser en kompakt opsummering ("X af Y
kalendere vises") med en `Button`, der folder alle grupper ud/ind —
"Vis alle" bevares uændret. Ens navngivne kilder skelnes ved at vise
udbyder-typen som en lille sekundær tekst under navnet (fx "Google" /
"Outlook" / "iCloud" / "Abonnement"), hentet fra `source.id`'s allerede
eksisterende udbyder-præfiks. Advarselsikoner (fejlende kilder) får
`title`/`aria-label`-tooltip med den samme fejltekst, providerHealth
allerede leverer.

### I. Indstillinger

- `SettingsPage.tsx` er i dag 7 selvstændige sektioner i ét fladt,
  lodret grid (`FamilySection`, `BirthdaysSection`,
  `SharedExpensesSection`, `CalendarConnectionsSection`,
  `AppNotificationsSection`, `AccountDataSection`, `HelpFeedbackSection`)
  — 2.912 linjer samlet komponentkode. Ingen faner/accordions findes i
  dag; hver sektion er et kort med rækker, der åbner dialoger.
  Feature-flag-dialogen ligger i dag inde i `HelpFeedbackSection`, langt
  fra hvor man intuitivt ville lede.
- Ingen dyb-linking findes ind i Indstillinger i dag (kun `navigate
  ("/settings")` uden state/anker) — men `CalendarPage` beviser mønsteret
  allerede findes i appen (`location.state.openNewEventDialog`), så det
  kan genbruges uden ny arkitektur.

**Beslutning:** MUI `Tabs` (lokal komponent-state, ingen routing-ændring)
med de 5 påkrævede minimumskategorier, som en tynd, ren omfordeling af de
eksisterende 7 sektioner — ingen sektions interne indhold ændres:

1. **Familie** — `FamilySection`.
2. **Kalenderforbindelser** — `CalendarConnectionsSection`.
3. **Funktioner og notifikationer** — `AppNotificationsSection` +
   feature-flag-dialogen flyttes hertil fra `HelpFeedbackSection` (mere
   logisk placering, ingen funktionsændring).
4. **Konto og data** — `AccountDataSection` (destruktive handlinger
   forbliver tydeligt markeret som i dag, uændret internt).
5. **Hjælp og feedback** — resten af `HelpFeedbackSection` (feedback,
   version) + `BirthdaysSection` og `SharedExpensesSection` placeres
   under "Familie" som undersektioner (de er familiedata, ikke
   kerne-kontoindstillinger) — vurderes endeligt under implementering ud
   fra hvad der giver den mest naturlige gruppering uden at opfinde en
   6. kategori.

På mobil bevares samme `Tabs`-komponent i en scrollbar variant (MUI
`Tabs variant="scrollable"`) — ingen tungere mobilvisning, ingen ekstra
navigations-niveau.

**[RETTET efter Nicolajs review — planen herunder er erstattet.]**
Planen beskrev oprindeligt `location.state.settingsTab`
(`CalendarPage`/`openNewEventDialog`-mønsteret) som "forberedt til
fremtidig dyb-linking", uden at noget eksisterende kaldested skulle
ændres i denne sprint. Reviewet påpegede korrekt, at fanedelingen i sig
selv gjorde `navigate("/settings")` til en regression: ethvert link/
enhver besked, der før ramte den rigtige indstilling direkte i den
udelte side, ville nu altid lande på standardfanen. `location.state`
overlever desuden hverken en genindlæsning eller et delt/åbnet-i-ny-
fane-link, så det ville ikke reelt løse problemet. Implementeret i
stedet med en `?tab=`-URL-parameter (`useSearchParams`, `replace: true`
ved faneskift), som er stabil under genindlæsning og deling. Forsidens
"Se familien"-knap (tidligere blot `navigate("/settings")`) peger nu
eksplicit på `/settings?tab=family`.

### J. Dokumentation

- Lokal `main`-baseret checkout var ~19 sprints bagud (CHANGELOG stopper
  ved Sprint 37, `PROJECT_STATUS.md` kalder Sprint 37 "aktuel fase") —
  irrelevant for dette arbejde, da branchen nu er rebygget fra
  `develop`, hvis egen `CHANGELOG.md`/`PROJECT_STATUS.md` allerede er
  ajour til og med Sprint 56.
- `develop`s `PROJECT_STATUS.md` flager allerede selv (2026-09-19-boks),
  at dens "Aktuel fase"/"Leveret"-brødtekst er forældet og at
  `CHANGELOG.md` er den autoritative kilde — dette mønster videreføres,
  ikke "løses" ved at omskrive hele dokumentet.
- Versionsvisning: allerede live og korrekt sourcet fra Cloudflares
  `CF_VERSION_METADATA` via `/api/health` → `useDeploymentVersion.ts`
  (12-tegns forkortet deployment-id, vist i "Hjælp og feedback").
  `package.json`s `"version": "0.0.0"` er en ubrugt npm-konvention, ikke
  det viste tal. En "mere meningsfuld" version kunne være at vise
  `Sprint 57`/semver-lignende label ved siden af id'et — men da dette
  kræver enten en build-time-injiceret variabel (Vite `define`) eller en
  ny env-binding, og opgaven eksplicit kun tillader ændringer der "ikke
  forstyrrer Cloudflare-deploymentet", vurderes dette under
  implementering; hvis det ikke kan gøres uden risiko for deploy, undlades
  det og flages i CHANGELOG som bevidst udskudt.

**Beslutning:** tilføj et `## Sprint 57 — ...`-afsnit øverst i
`CHANGELOG.md` (samme stil som Sprint 55/56), opdatér
`PROJECT_STATUS.md`s dato/status-boks til at nævne Sprint 57, og
opdatér `README.md`, hvis dens funktionsoversigt nævner noget, der
ændrer sig synligt (kalenderbredde, Indstillinger-struktur). Intet
arkitekturdokument/ADR forventes nødvendigt, da det nye cache-lag (punkt
E) er en lille, afgrænset udvidelse af et allerede dokumenteret mønster,
ikke en ny arkitekturbeslutning.

---

## Berørte filer og komponenter (oversigt)

**Server:**
`server/routes/familyRoutes/childAccessManagement.ts`,
`server/routes/familyRoutes/childMessages.ts`,
`server/routes/familyRoutes/familyMembers.ts`,
`server/routes/familyRoutes/featureFlags.ts`.

**Klient — børneadgang/features:**
`src/pages/MitIDagPage.tsx`,
`src/features/family/components/ChildAccessAdminPanel.tsx`,
`src/features/settings/components/FeatureFlagsDialog.tsx`,
`src/pages/HomePage.tsx`.

**Klient — kalender/ydelse:**
`src/features/calendar/hooks/useCalendarEvents.ts`,
`src/features/calendar/models/calendarProvider.ts`,
`src/features/calendar/hooks/useCalendarPageController.ts`,
`src/features/calendar/components/FamilyPlannerCalendar.tsx`,
`src/features/family/hooks/useEnabledFeatures.ts`,
`src/features/calendar/hooks/useFamilyMembers.ts`,
`src/features/calendar/hooks/useCurrentMember.ts`,
`src/layouts/AppLayout.tsx`,
ny fil: `src/features/family/familySessionCache.ts`.

**Klient — layout/UX:**
`src/layouts/AppLayout.tsx` (bredde),
`src/features/calendar/components/CalendarSourceFilter.tsx`,
`src/pages/SettingsPage.tsx`.

**Dokumentation:**
`README.md`, `CHANGELOG.md`, `PROJECT_STATUS.md`, denne plan.

**Ingen D1-migration forventes** — alle ovenstående rettelser er
applikationslogik oven på det eksisterende skema.

---

## Arkitekturbeslutninger

1. **Ingen ny state-management-platform.** Det eksisterende
   "modul-cache + CustomEvent"-mønster udvides, i stedet for at
   introducere React Query/SWR/Zustand. Begrundelse: mønsteret findes
   allerede to steder i kodebasen, er velforstået, kræver ingen ny
   afhængighed, og dækker det faktiske behov (deduplikering af nogle få
   hyppigt kaldte, sjældent skiftende endpoints) uden generel
   cache-invalidering på tværs af vilkårlige queries.
2. **Kalenderaftaler cachologisk IKKE via det generiske lag** — for
   høj risiko for at vise et forkert interval for en given side. Løses i
   stedet ved at hver side selv beder om det rigtige interval (punkt D).
3. **`relation`-strengen forbliver den kanoniske børn/voksen-markør**,
   nu server-side håndhævet som en allow-list, fremfor at indføre en ny
   `is_child`-kolonne — mindste indgreb, der stadig opfylder kravet om
   ikke at stole på ubegrænset fri tekst.
4. **Featureflag-afhængigheder løses udelukkende server-side, atomisk
   via D1 `batch()`** — klienten forbliver en ren visning af serverens
   svar; ingen klient-side "hvad skal jeg også slå til/fra"-logik, der
   kunne komme ud af trit med serverens regler.
5. **Kalenderens bredde styres af rute, ikke af en ny layout-variant** —
   mindste ændring i `AppLayout`, ingen ny fælles container-komponent.

---

## Risici

- **Gentagne iCloud-aftaler kan blive mindre synlige.** Eksploration
  bekræftede (kode læst, ikke antaget) at `icloudCalDav.ts` allerede i
  dag aldrig udfolder RRULE — en gentagen mesteraftale vises kun ved sin
  egen (evt. gamle) startdato, uafhængigt af intervalstørrelse. Dette er
  en eksisterende fejl, som indsnævring gør mere mærkbar, men ikke
  skaber. Mitigeres ved IKKE at ændre iCloud-provideren i denne sprint
  (kun hvilket interval der sendes ind udefra), og ved eksplicit at
  dokumentere fundet i CHANGELOG/PR som en kendt begrænsning, der kræver
  en selvstændig sprint — ikke ved at forsøge en risikabel bi-rettelse
  af `icloudCalDav.ts`s RRULE-håndtering her.
- **[RETTET efter Nicolajs review — oprindeligt fejlvurderet som
  harmløst.] Google-kalenderdata kunne mangle aftaler, ikke kun undlade
  at blive reduceret i mængde.** Den oprindelige analyse konkluderede
  fejlagtigt, at intervalindsnævring var "harmløs, blot uden fuld
  effekt" for Google. Det er forkert: `GoogleCalendarProvider` ignorerer
  ganske vist `range` fuldt ud, når et `syncToken` allerede er cachet —
  men det cachede events-sæt er kun så fuldstændigt, som den seneste
  FULDE synks interval var. Når Forsidens smalle 14-dages-vindue rammer
  en tom cache FØRST, opbygges cachen kun for de 14 dage; en efterfølgende
  bredere forespørgsel (måneds-/ugevisningen) genbrugte blot det samme
  syncToken uden selv at udføre en intervalbaseret synk — en aftale uden
  for de oprindelige 14 dage ville derfor aldrig blive hentet og kunne
  reelt mangle i kalenderen. Dette var en funktionel fejl, ikke kun en
  udeblevet ydelsesgevinst.
  **Rettelse:** `GoogleCalendarSyncCacheState` gemmer nu det interval
  (`rangeStart`/`rangeEnd`), den seneste fulde synk dækkede. Kun når et
  efterspurgt interval er en delmængde heraf, genbruges den billige
  inkrementelle syncToken-synk; ellers udføres en ny, fuld synk med
  UNIONEN af det gamle og det nye interval, og cachens dækning
  opdateres tilsvarende. En allerede gemt, ældre cache-post (uden de nye
  felter) behandles som ugyldig og udløser en frisk fuld synk, i stedet
  for at blive brugt med et ukendt/antaget dækningsinterval. Se
  `GoogleCalendarProvider.ts`s `fetchCalendarEvents`/`isRangeCovered`/
  `unionRange`, samt den nye regressionstest i
  `GoogleCalendarProvider.test.ts`, der eksplicit reproducerer
  scenariet: et smalt interval først, derefter et bredere, og
  bekræfter at en aftale uden for det første interval kommer med i det
  andet kald.
- **Multi-dags-/gentagelsesregression generelt.** Mitigeres ved at
  bevare/udvide `expandRecurringEvents.test.ts` og
  `calendarPageDateNavigation.test.ts` med grænsetilfælde-tests for
  Outlook/ICS (de to kilder, hvor indsnævring reelt tager effekt), samt
  ved at køre hele den eksisterende Playwright-regressionspakke for
  gentagelser/flerdage/privatliv/konflikt efter hver enkelt
  interval-ændring (ikke kun samlet til sidst).
- **Cache-lag introducerer forældet data**, hvis en mutation glemmer at
  kalde `invalidateFamilyCache()`. Mitigeres med kort TTL (sekunder, ikke
  minutter) som sikkerhedsnet, og ved at holde cachen til kun de mest
  stabile, sjældent skiftende data (familie/medlemmer/roller), ikke
  hyppigt skiftende data som opgaver/kalenderaftaler.
- **Featureflag-kaskaden deaktiverer en underfunktion, brugeren ikke
  forventede blev påvirket**, hvis de deaktiverer Opgaver uden at huske
  Rutiner/Opgave-belønning var aktive. Mitigeres med tydelig
  dialogtekst (punkt B) og ved at kaskaden er synlig med det samme
  (alle tre kontakter opdateres reaktivt i samme dialog).
- **Børneadgangs-rettelsen bryder eksisterende gyldig adgang for
  Alfred/Jens/andre børn**, hvis `relation`-værdien for disse i praksis
  afviger fra præcis strengen `"Barn"` (fx forskellig
  store/små bogstaver eller whitespace fra ældre data). Mitigeres ved at
  inspicere faktisk lagret data for eksisterende børneprofiler før
  serverændringen deployes til beta (via `verify-migrations`-skillets
  tilgang: en direkte, skrivebeskyttet `sqlite_master`/tabel-forespørgsel
  mod beta-databasen, ikke en antagelse) — se Teststrategi.
- **Force-with-lease-push til den tildelte branch** kræver Nicolajs
  eksplicitte godkendelse (blokeret af sessionens
  auto-mode-klassifikator) — flages ved commit-fasen, ikke en teknisk
  risiko for selve koden, men en proces-afhængighed for at kunne aflevere
  sprinten.

---

## Teststrategi

**Server (Vitest):**
- `childAccessManagement.test.ts`: ny test — forsøg på at aktivere
  børneadgang (token/PIN) for et medlem med `relation = 'Far'` afvises
  (404, samme mønster som eksisterende pseudoprofil-test). Eksisterende
  `Barn`-baserede tests skal fortsat bestå uændret.
- `childMessages.test.ts`: samme mønster for `isRealFamilyMember`.
- `familyMembers.test.ts` (eller tilsvarende i `families.test.ts`): ny
  test — POST/PATCH med en ukendt `relation`-værdi afvises (400).
- `featureFlags`-tests i `families.test.ts`: nye tests — aktivering af
  `routines` uden `tasks` resulterer i begge aktive; deaktivering af
  `tasks` med `routines`+`task-rewards` aktive resulterer i alle tre
  fra; en familie seedet direkte i `family_enabled_features` med kun
  `routines` (simulerer gammel, ugyldig tilstand) får `tasks` tilføjet
  ved næste GET.

**Klient (Vitest):**
- Ny test for `MitIDagPage`/`ChildAccessAdminPanel`-visning: børneadgang
  og Beskeder vises for et medlem med `relation: "Barn"`, ikke for
  `"Far"`/`"Mor"`/`"Andet"`.
- `useEnabledFeatures.test.ts` (ny): bekræfter reaktiv opdatering ved
  `enabledFeaturesChangedEvent`.
- `calendarPageDateNavigation.test.ts`: udvides med tests for de nye,
  snævrere fetch-intervaller pr. visning, inklusive grænsetilfælde for
  flerdagesaftaler.
- `getDefaultCalendarEventRange`/nye per-view range-funktioner:
  eksplicitte unit-tests for start/slut-grænser.

**Playwright (e2e), både `desktop-chromium` og `mobile-chromium`:**
- Ny scenarie: en ejer opretter en børneprofil og en voksen profil;
  bekræfter "Børneadgang for {barn}" vises for barnet, ikke for den
  voksne, på Mit i dag.
- Ny scenarie: aktivering af Rutiner fra "Flere funktioner" aktiverer
  også Opgaver synligt i navigationen, uden sideopdatering.
- Ny/udvidet scenarie: Hurtige handlinger på forsiden matcher aktiverede
  funktioner.
- Udvidelse af den eksisterende
  `"primary pages fit the complete supported mobile width matrix"`-test
  til også at dække 360px (i dag kun 320/375/390/430).
- Ny scenarie: kalendersiden bruger en bredere desktopcontainer end
  Overblik/Mit i dag/Indstillinger (målt bredde, ikke kun overflow).
- Ny scenarie: kalenderfilteret med mange (10+) kilder viser en
  sammenfoldet opsummering, som kan foldes ud.
- Ny scenarie: Indstillinger kan navigeres via faner på både desktop og
  mobil, og destruktive handlinger er fortsat tydeligt adskilt.
- Eksisterende scenarier for gentagelser, flerdages-, private og
  konflikt-aftaler (linje ~1519-2344 i `app-smoke.spec.ts`) skal
  fortsat bestå uændret — disse er den primære regressionsbeskyttelse
  for punkt D.
- Axe/keyboard-tests udvides til at dække de nye Indstillinger-faner.

**Kørsel:** `npm ci && npm run lint && npm run build && npm run
worker:types:check && npm test && npm run test:e2e && npm audit
--omit=dev --audit-level=high && git diff --check`, jf. opgavens Fase 4.
Fuld Playwright-suite køres mindst én gang før aflevering.

---

## Acceptkriterier

Som beskrevet i opgavens "Definition of Done" — gentages ikke her i sin
fulde form, men opsummeret pr. område: A (børn kun), B (ingen ugyldig
flag-tilstand mulig eller vedvarende), C (genveje følger flag), D (Mit i
dag/Overblik henter ikke tre års data), E (identiske grundkald
reduceret), F (delvist indhold ved langsomme kald), G (kalender bredere
på desktop), H (filter overskueligt), I (Indstillinger navigerbar), J
(dokumentation ajour og selvmodsigelser håndteret eller eksplicit
flaget).

---

## Hvad der bevidst ikke ændres

- Familie-/planlæggervisningens eget dynamiske vindue
  (`plannerWindowReducer.ts`) — allerede korrekt afgrænset.
- Godkendte konfliktregler (`findAllCalendarConflicts.ts`).
- Familiemedlemmernes valgte farver og farve-mapping.
- Privatlivsregler for private aftaler (`redactCalendarEventForViewer.ts`).
- Dedup-logikken (`deduplicateCalendarEvents.ts`) — kører uændret på det
  (nu mindre) rå datasæt.
- Cloudflare-/D1-/OAuth-/repositoryressourcer omdøbes ikke.
- Ingen ny D1-migration.
- Ingen nye hovedfunktioner, pointshop, kæledyr eller
  undervisningsfunktioner.
- Barnets egen session (`/barn/:token`, `routes/childAccess.ts`) ændres
  ikke funktionelt — kun de bagvedliggende admin-ruter, der opretter
  adgangen, får strammere validering; et allerede udstedt, gyldigt
  børne-token for et rigtigt barn fortsætter med at virke uændret.
- **Én eksisterende, upåagtet fund fra EXPLORE rettes bevidst IKKE i
  denne sprint** (dokumenteres som en kendt begrænsning, ikke som løst):
  `icloudCalDav.ts` udfolder aldrig RRULE-gentagelser (påvirker
  gentagne iCloud-aftaler uafhængigt af denne sprint) — kræver en
  selvstændig, fremtidig sprint med sin egen risikovurdering.
  **`GoogleCalendarProvider`s syncToken-cache ER derimod rettet** (efter
  Nicolajs review, se Risici) til at respektere et efterspurgt interval
  — den var oprindeligt fejlagtigt kategoriseret som "harmløs, kun
  udeblevet ydelsesgevinst", men var reelt en funktionel fejl, der kunne
  skjule aftaler.

---

## Plan for håndtering af allerede gemte ugyldige tilstande

- **Feature flags:** selv-helbredende ved hver `GET
  /:id/enabled-features` (se punkt B) — ingen manuel oprydning, ingen
  migration, ingen destruktiv handling mod eksisterende data.
- **Børneadgang:** ingen automatisk oprydning af eventuelt allerede
  udstedte tokens/PIN-koder for voksne (usandsynligt i praksis, men ikke
  udelukket i beta-data) — dette ville kræve at slette/ændre reelle
  beta-data, hvilket er eksplicit forbudt uden Nicolajs stillingtagen.
  I stedet: den nye server-side validering forhindrer NY aktivering for
  voksne; hvis en eksisterende voksen-token findes, flages det til
  Nicolaj som et separat, manuelt beslutningspunkt (ikke noget denne
  sprint retter automatisk), efter en direkte, skrivebeskyttet
  forespørgsel mod beta-databasen har bekræftet, om det overhovedet
  forekommer.

---

## Plan for at undgå regressioner i gentagelser, privatliv og providerintegrationer

1. Ændr `useCalendarEvents` til at acceptere `range` som parameter, men
   behold `getDefaultCalendarEventRange()` som eksplicit default — ingen
   eksisterende kaldested, der ikke selv opdateres, ændrer adfærd.
2. Opdatér kaldesteder ét ad gangen (Mit i dag → Overblik → Kalenderens
   måned/uge/dag → planlægger), med den fulde Playwright-regressionspakke
   for gentagelser/flerdage/privatliv/konflikt kørt efter hver enkelt
   ændring, ikke kun samlet til sidst.
3. Behold `getVisibleRange()`s eksisterende rundhåndede buffer (7 dage
   for måned, 7/14 og 3/4 dage for uge/dag) i stedet for et matematisk
   minimalt interval — bekræftet tilstrækkelig for Outlook/ICS's
   overlap-korrekte filtrering.
4. Rør ikke ved `deduplicateCalendarEvents`,
   `redactCalendarEventForViewer`, `findAllCalendarConflicts` eller
   `expandRecurringEvents`s interne logik — kun hvilket `range` der
   sendes ind udefra ændres.
5. Offline-cache (ICS: `icsCalendarSyncCacheStorage.ts`) er allerede
   nøglet pr. abonnement, ikke pr. forespurgt interval — narrowing af
   `range` påvirker ikke cache-nøglerne, kun hvor meget der hentes ved en
   frisk hentning.

---

## Sprintopdeling (foreslåede commits)

1. `fix(server): håndhæv at børneadgang kun kan aktiveres for børn`
2. `fix(web): vis kun Mit i dags børneadgang og beskeder for børneprofiler`
3. `fix(server): valider relation ved oprettelse/redigering af familiemedlemmer`
4. `feat(server): håndhæv featureflag-afhængigheder atomisk`
5. `feat(web): forklar featureflag-afhængigheder i dialogen`
6. `fix(web): hurtige handlinger følger aktiverede funktioner`
7. `perf(web): begræns kalenderens hente-interval pr. visning`
8. `perf(web): del family-/features-/kilde-opslag via et let cache-lag`
9. `feat(web): progressiv indlæsning på Mit i dag`
10. `fix(web): bredere kalendercontainer på desktop`
11. `feat(web): gruppér kalenderfilteret pr. medlem`
12. `feat(web): opdel Indstillinger i faner`
13. `test: udvid Vitest- og Playwright-dækning for Sprint 57`
14. `docs: opdatér CHANGELOG, PROJECT_STATUS og README for Sprint 57`

Rækkefølgen tillader kørsel af det fulde testsuite efter hver commit og
isolerer den højest-risiko-ændring (D, kalenderintervaller) fra de
lavrisiko-ændringer (G, layout), der kan verificeres uafhængigt.
