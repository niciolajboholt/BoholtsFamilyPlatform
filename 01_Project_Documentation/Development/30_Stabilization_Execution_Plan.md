# Stabiliserings- og lanceringsplan

| Felt | Værdi |
|---|---|
| Status | Aktiv |
| Version | 1.0 |
| Senest opdateret | 2026-08-28 |
| Ejer | Nicolaj Boholts |
| Arbejdsgren | `develop` |
| Produktionsgren | `main` |
| Vedligeholdes af | Codex og efterfølgende udviklingsagenter |

## Formål og statusprincip

Dette dokument er den autoritative arbejdslog for stabiliseringen af Boholts
Familieapp. Det beskriver den oprindelige otte-fasede plan, hvad der er
gennemført, hvad der mangler, hvilke acceptkriterier der gælder, og hvad den
næste konkrete handling er.

Dokumentet skal opdateres i samme pull request som enhver væsentlig ændring i
planen. Et punkt markeres først som gennemført, når ændringen er implementeret,
testet og kan knyttes til en commit, pull request, CI-kørsel eller manuel
verifikation.

### Statusforklaring

- **Gennemført**: Acceptkriteriet er implementeret og verificeret.
- **Delvist gennemført**: En brugbar del er leveret, men fasens samlede
  acceptkriterier er ikke opfyldt.
- **Ikke startet**: Der er endnu ikke leveret kode til punktet.
- **Ekstern handling**: Kræver kontoindstillinger, fysisk enhed eller en
  beslutning uden for kodebasen. Det øvrige arbejde fortsætter imens.

## Ledelsesoverblik

| Fase | Område | Status | Næste vigtigste restpunkt |
|---:|---|---|---|
| 1 | Kalenderens UI og dubletter | Delvist gennemført | Ingen — kun kildespecifik dubletanalyse, hvis en dublet observeres igen |
| 2 | Tilgængelighed og visuelt polish | Gennemført | — |
| 3 | Privatliv og AI | Gennemført | — |
| 4 | Login, branding og OAuth | Delvist gennemført | Google-verificering, consent-branding og domænevalg (alle eksterne, Google Cloud Console) |
| 5 | Browserbaserede brugerflowtests | Gennemført | — |
| 6 | Refaktorering | Gennemført | — |
| 7 | Release, drift og dokumentation | Delvist gennemført | D1-gendannelsesøvelse og kontrolleret release til `main` (begge kræver aftalt tidspunkt med Nicolaj) |
| 8 | Offlineoplevelse | Gennemført | — |
| 9 | ICS-abonnementskalendere | Gennemført | — |

Appen er egnet til kontrolleret familiebrug og beta. Den er ikke vurderet som
offentligt lanceringsklar, før privatliv pr. aftale, OAuth-verificering,
kritiske E2E-flows og de resterende driftsværn er færdige.

## Verificeret baseline

Status pr. 2026-08-27:

- Stabiliseringspakken er merged til `develop` i
  [PR #102](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/102).
- Mobil familieagenda er merged til `develop` i
  [PR #103](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/103).
- Seneste kendte `develop`-commit er `f085fe22def57d0b80ad478879cac5329c0bf163`
  (PR #109). Dette tal går forældet ved næste merge — se `git log origin/develop`
  for den faktiske aktuelle HEAD i stedet for at stole blindt på denne linje.
- Seneste grønne fulde pipeline (kvalitet + beta-migration + beta-deploy +
  live health-verifikation) er
  [GitHub Actions #327](https://github.com/niciolajboholt/BoholtsFamilyPlatform/actions/runs/33089792669).
- Betaens `/api/health` rapporterer database og migrationsstatus som grøn.
- Aktiv Cloudflare-version ændrer sig ved hver merge til `develop` (automatisk
  beta-deploy) — se Indstillinger i appen eller `/api/health` for den aktuelle
  værdi i stedet for et fastfrosset tal her.
- D1-migrationsregisteret er baselinet for migration 0002-0016, og migration
  0017 er anvendt på beta.
- Lokal kvalitetsbaseline: lint, produktionsbuild og 519 Vitest-tests består.
- Playwright indeholder login/jura, autentificeret navigation, kalenderlayout,
  kontrolnavne, en automatisk WCAG 2.0/2.1 A/AA-audit (axe-core) af de fem
  hovedsider, offline-scenarier, privatlivs-redaktion (ejer/andet medlem +
  offentligt delelink) og mobilbredde-matrix på desktop- og mobilprojekter.
- Produktionsafhængigheder havde 0 kendte npm-sårbarheder ved sidste audit.
- `main` og `develop` er nu beskyttede branches: PR med mindst 1 godkendelse
  og en grøn `Lint, build and test`-statuscheck er påkrævet, branchen skal
  være up to date før merge, og ingen (inkl. repository-ejeren) kan omgå
  reglen. Sat op af Nicolaj 2026-08-27.

## Fase 1 – Kalenderens konkrete UI-fejl

**Mål:** Kalenderen skal være let at afkode på mobil og desktop uden overlap,
utilsigtede dubletter eller unødigt vandret scroll.

**Status: Delvist gennemført**

### Gennemført

- [x] Den kolliderende sticky-adfærd i familieplannerens ugebånd er fjernet.
- [x] Fordelingsreglen er gjort entydig: flerpersonsaftaler vises i
  familiekolonnen og ikke samtidig som den samme planner-post i hver
  personkolonne.
- [x] Fordelingsreglen har enhedstest.
- [x] Familievisningen under 600 px er erstattet af en lodret agenda med dato,
  person og aftalekort.
- [x] Mobilvisningen har Playwright-regression mod vandret overflow.
- [x] Provider-resultater deduplikeres kun på stabil identitet: kilde,
  kalender-id, event-id og forekomststart. Seneste identiske kopi vinder.
- [x] Deduplikeringen har regressionstests, som bevarer reelle ens aftaler og
  forskellige forekomster af gentagelser.
- [x] Månedsvisningen viser op til tre aftaler med to tekstlinjer fra
  tabletbredde og bevarer den fulde titel som tilgængelig handling/tooltip.
- [x] Ugevisningen bruger en responsiv agenda med højst tre kolonner i stedet
  for syv smalle desktopkolonner og har en Playwright-layouttest.
- [x] Fejlrapport fra Nicolaj (skærmbillede): en aftale med flere navngivne
  personer i titlen (fx "Christine og Jens KBH") viste sig som den generiske
  lilla "Familien"-farve/mærkat, selvom aftalen reelt var for to specifikke
  medlemmer. Reprodukeret præcist med en Playwright-testopsætning, der
  matchede skærmbilledet. **Rodårsag:** aftalens farve/ejerskab kom
  udelukkende fra hvilken Google-KALENDER aftalen lå på (kalender-til-
  medlem-tildelingen i Indstillinger) — appen læste aldrig aftalens egen
  Google-deltagerliste og gættede heller ikke ud fra titlen. Løst efter
  aftale med Nicolaj (valgte "Læs deltagere fra Google" af tre foreslåede
  retninger): `matchAttendeesToOwnerIds.ts` matcher nu en Google-aftales
  `attendees`-e-mails mod familiemedlemmernes koblede konto-e-mail (ny
  `linkedUserEmail`, tilføjet server-side via `LEFT JOIN users` i
  `listFamilyMembers()` og ført igennem klientens `CalendarOwner`/
  `FamilyMemberDto`) — matcher det, går forud for kalender-tildelingen;
  matcher intet (fx ingen deltagere, eller kun eksterne e-mails), falder
  tilbage til den hidtidige kalender-baserede adfærd uændret. Et medlem uden
  koblet konto (fx et barn) kan ikke matches denne vej. Verificeret med nye
  enhedstests (`matchAttendeesToOwnerIds.test.ts`,
  `googleCalendarMapper.test.ts`) og en visuel Playwright-reproduktion
  før/efter, sendt til Nicolaj som skærmbilleder.
- [x] Opfølgning fra Nicolaj på ovenstående (PR #148 var da allerede merget —
  ny PR, samme fejlkategori): `getEventOwnerColor()` faldt stadig tilbage
  til Familien-farven, når en aftale havde MERE end én matchet ejer (den
  netop tilføjede deltagermatchning ramte netop denne gren), og et
  ikke-tildelt ICS-abonnement fik slet intet ejerskab på selve AFTALEN,
  så dets egen valgte farve (allerede korrekt brugt på selve KILDEN, jf.
  `mapIcsCalendarSource()`) aldrig nåede aftalekortet. Én central regel
  rettet ét sted (`getEventOwnerColor.ts`, ny `getEventOwnerColors()` +
  `getEventOwnerBorderSx()`), brugt identisk af alle fem visninger
  (måned/`DayCell`, uge/`WeekCalendar`, dag/`DayCalendar`,
  familie/`FamilyPlannerCalendar`, liste/`EventList`) i stedet for
  specialregler pr. komponent:
  1. Reel family-tilknytning → Familien-farven.
  2. Ét eller flere matchede medlemmer → deres egne farver — en opdelt,
     skarpt afgrænset venstrekant ved flere (`border-image`, ikke en blødt
     overtonet gradient), ikke Familien-farven.
  3. Intet medlem-ejerskab, men aftalen har sin egen kildefarve (nyt
     `CalendarEvent.color`-felt, sat af `icsCalendarMapper.ts` fra
     abonnementets `color`) → den farve.
  4. Intet af ovenstående → neutral standardfarve.
  15 nye/ændrede enhedstests (`getEventOwnerColor.test.ts`,
  `icsCalendarMapper.test.ts` — ny fil, mapperen havde ingen tests før) +
  2 nye Playwright-tests, der beviser den FAKTISKE gengivne CSS-farve
  (`getComputedStyle().borderImageSource`/`.borderLeftColor`), ikke kun
  `ownerIds`-værdien. Synlig funktionsændring — egen PR, til gennemgang,
  ikke selv-merget.
- [x] Genverificeret manuelt af Nicolaj på fysisk iPhone (Safari/PWA,
  2026-08-29): måned-, uge- og familieagenda-visningen samt de seneste
  aftalefarve-rettelser blev gennemgået direkte på beta — ingen overlap,
  ingen vandret scroll, ingen synlige dubletter observeret.

### Mangler

- [ ] Spor synlige dubletter til kilden: flere kalenderkilder,
  gentagelsesudfoldning eller medlemsmapping. Ingen aktiv fejlrapport lige
  nu — punktet aktiveres kun, hvis en dublet reelt observeres igen.

### Acceptkriterier

- Ingen overlappende overskrifter eller vandret side-overflow ved 320-430 px.
- Ingen utilsigtede dubletter.
- Gentagne aftaler og to reelt forskellige aftaler med samme titel/tidspunkt
  bevares.
- Måned, uge, dag og familievisning fungerer på desktop og mobil.

**Næste handling:** Ingen aktiv handling — mobilverifikationen er
gennemført. Dublet-sporing tages kun op, hvis en dublet observeres igen.

## Fase 2 – Tilgængelighed og visuelt polish

**Mål:** Alle primære flows skal kunne forstås og betjenes med tastatur,
skærmlæser og smalle mobilskærme uden at ændre appens varme grønne design.

**Status: Gennemført**

### Gennemført

- [x] Opgaveformularens berørte combobox- og datofelter har forståelige
  accessible names og bruger den aktuelle MUI slot-API.
- [x] Familiemedlemsrækker i Indstillinger er venstrestillet og gjort lettere
  at skimme.
- [x] Overflødig højde og spacing er reduceret i de berørte indstillinger.
- [x] Installations- og notifikationsvejledning er forbedret på mobil.
- [x] Familieplannerens mobilvisning undgår vandret overflow.
- [x] Alle fem hovedsider testes automatisk ved 320, 375, 390 og 430 px uden
  vandret side-overflow.
- [x] Alle synlige knapper, links og formularfelter på hovedsiderne kontrolleres
  automatisk for et tilgængeligt navn.
- [x] Pushnotifikationskontakten i Indstillinger har fået et eksplicit
  tilgængeligt navn efter den automatiske audit.
- [x] Automatisk WCAG 2.0/2.1 A/AA-audit (axe-core) af alle fem hovedsider
  indført som fast Playwright-test.
- [x] Navigationsmenuens liste i `AppLayout.tsx` bruger nu gyldig
  `<ul>`/`<li>`-semantik (hver `ListItemButton` pakket i `ListItem`).
- [x] Tre marginale WCAG AA-kontrastbrud rettet: kalenderens nedtonede
  datotal for dage uden for måneden, ikke-valgte faneblade og
  "Log ud"-knappens røde tekst.
- [x] Automatiseret tastatur-/fokusgennemgang som faste Playwright-tests
  (axe-core tjekker kun statisk ARIA-opmærkning, ikke reel
  tastaturbetjening): (1) på alle fem hovedsider tabbes der reelt igennem
  desktop-venstremenuen — alle fem punkter skal nås, og intet fokuseret
  element må have en tom `getClientRects()` (dvs. reelt usynligt); (2) en
  Indstillinger-dialog (Kalenderforbindelser) skal fange fokus, mens den er
  åben — Tab langt ud over antallet af fokuserbare elementer i den må aldrig
  sive fokus ud til siden bagved — og Escape skal lukke dialogen og
  returnere fokus til den knap, der åbnede den. Ingen fejl fundet; MUI's
  indbyggede Dialog-fokusfælde og sidebar-menuens fokusrækkefølge virker
  allerede korrekt. Ren test, ingen adfærdsændring.

- [x] Fysisk test med iPhone Safari, installeret PWA og VoiceOver udført af
  Nicolaj (2026-08-29): bundmenuens navigation, tilføjelse af
  indkøbsvare/opgave og åbning af en kalenderaftale blev alle gennemgået
  med VoiceOver aktiveret på beta. Ingen problemer fundet — alt annonceres
  forståeligt, og ingen fokus- eller labelproblemer observeret.
- [x] Opfølgning på issue #20's sidste kriterie ("farve er ikke eneste
  informationsbærer", WCAG 1.4.1): en målrettet gennemgang fandt, at
  måned- og dagsvisningen (`DayCell.tsx`, `DayCalendar.tsx`) hidtil KUN
  brugte aftalens kant-/baggrundsfarve til at vise, hvilket familiemedlem
  aftalen tilhører — intet synligt navn eller ikon, i modsætning til
  uge- og familievisningen, som allerede viste navnet som tekst. Rettet
  med et nyt, lille synligt badge (`EventOwnerBadges.tsx`, forbogstav i
  hvidt på medlemmets farve, op til 3 pr. aftale) på både aftalekortene og
  dags-oversigtsprikkerne øverst i en måned-celle. Samtidig udvidet
  `getEventActionLabel()` (`calendarAccessibility.ts`) til også at
  inkludere ejernavnet i aria-labelen på alle fire kalendervisninger — den
  indeholdt hidtil slet intet ejernavn, så skærmlæsere fik heller ingen
  besked om, hvem aftalen tilhørte. Godkendt visuelt af Nicolaj ud fra
  skærmbilleder af måned- og dagsvisningen. Synlig funktionsændring — til
  gennemgang, ikke selv-merget.

### Acceptkriterier

- Ingen formularfelter uden et forståeligt navn.
- Ingen vandret overflow i primære flows.
- Alle primære handlinger kan nås og aktiveres med tastatur.
- Kritiske farvekombinationer opfylder relevante WCAG-kontrastkrav.

**Næste handling:** Ingen — fasen er gennemført.

## Fase 3 – Privatliv og AI

**Mål:** Et familiemedlem skal kunne dele sin tilgængelighed uden at dele
følsomme titler, beskrivelser eller lokationer, og AI-behandling skal være et
bevidst valg.

**Status: Gennemført**

### Gennemført

- [x] Migration 0017 tilføjer familieindstillingen
  `ai_weekly_summary_enabled`.
- [x] AI-ugeresumé kan slås til og fra i Indstillinger.
- [x] Serveren og cron-jobbet håndhæver fravalget, før familiedata samles til
  AI-resuméet.
- [x] Delelinks viser som udgangspunkt ikke beskrivelse eller lokation; disse
  kræver et aktivt tilvalg.
- [x] Privatlivspolitikken beskriver de væsentlige databehandlinger.
- [x] Eksisterende Google- og Outlook-aftaler markeret `private` eller
  `confidential` genkendes som “vis kun optaget”.
- [x] Private Google-felter redigeres server-side til “Optaget”, før de kan nå
  offentlige delelinks eller AI-ugeresuméet.
- [x] Kalenderændrings-push og tidsbaserede påmindelser bruger en generisk
  privat tekst uden titel.
- [x] I den autentificerede app kan kun det familiemedlem, kalenderen er
  knyttet til, se private detaljer; andre ser tidspunkt og “Optaget”.
- [x] Manglende profilkobling bruger den sikre standard og redigerer detaljerne.
- [x] Redaktionslaget har tests mod titel, beskrivelse og lokation i klient,
  serveraggregation og push.
- [x] Opret- og redigér-dialogerne har en tydelig kontakt med teksten “Privat
  aftale – familien ser kun Optaget”.
- [x] Privatlivsvalget skrives til Google `visibility` og Outlook
  `sensitivity`; fravalg rydder providerens private markering eksplicit.
- [x] Provider-mapperne og det mock-baserede browserflow tester både privat og
  almindelig lagring uden rigtige kalenderdata.
- [x] Reel Playwright-E2E (ikke kun enhedstests af den isolerede
  redaktionsfunktion): en privat aftale er fuldt synlig for det familiemedlem,
  kalenderen er kortlagt til, og redigeres til kun tid + "Optaget" — uden
  titel/beskrivelse/lokation nogetsteds i DOM'en — for et andet familiemedlem
  på samme enhed.
- [x] Reel Playwright-E2E af det offentlige delelink (`/share/:token`, uden
  session-cookie, præcis som en modtager ville opleve det): en almindelig
  aftale viser fuld titel/beskrivelse/lokation, en privat aftale viser kun
  "Optaget" uden nogen af de øvrige felter.
- [x] Eksplicit servertest for, at AI-ugeresuméet aldrig videresender en privat
  aftales beskrivelse/lokation — selv i en simuleret situation, hvor
  aggregationslaget fejlagtigt skulle inkludere dem, dropper
  `collectUpcomingEvents()`'s egen type/mapping dem uafhængigt.
- [x] Eksplicit servertest for den sikre standard, når et familiemedlem slet
  ikke har en kalender-kortlægning: intet vises for vedkommende (ikke en
  gættet fallback).
- [x] Reel Playwright-E2E af selve REDIGERINGS-flowet af en privat aftale
  (ikke kun læsning/visning, som allerede var dækket): (1) et almindeligt
  feltskift på en eksisterende privat aftale bevarer `visibility: "private"`
  i det faktiske skrivekald til Google, og (2) at slå
  "Privat aftale"-kontakten fra og gemme sender rent faktisk
  `visibility: "default"` — ikke kun en lokal UI-opdatering. Ingen fejl
  fundet, ren test.
- [x] Præcis dokumentation af hvilke felter Workers AI modtager, og
  databehandlingens levetid: `32_Workers_AI_Data_Policy.md` — kodeverificeret
  gennemgang af alle tre AI-brugssteder (rutine-/ingrediensforslag,
  ugeresumé), hvilke konkrete felter der sendes/aldrig sendes, bekræftelse
  af at kaldet går uden om AI Gateway (dennes logging-adfærd er derfor
  irrelevant), og at fejlhåndteringen aldrig logger selve prompten. Selve
  Cloudflares infrastruktur-interne opbevaringsperiode kan ikke bekræftes
  med en autoritativ kilde herfra — flaget som ekstern verifikation, samme
  kategori som Fase 4's Google-gennemgang.
- [x] Privatlivssikre standardværdier for nye familier og nye delinger —
  kodeverificeret (2026-08-29) og godkendt af Nicolaj: en ny aftale er som
  udgangspunkt synlig for familien (`privacy: "details"`), hvilket er
  tilsigtet og fornuftigt for en tillid-baseret familieapp — at skjule alt
  for ens egen familie som standard ville kun give unødig friktion. Et nyt
  offentligt delelink inkluderer derimod ALDRIG beskrivelse eller lokation,
  medmindre det aktivt slås til ved oprettelsen
  (`body.includeDescription === true`/`includeLocation === true` i
  `shareLinks.ts`, ellers `false`). Begge standarder var allerede korrekte
  i koden — punktet lukkes uden kodeændring.
- [x] Separat privatlivsvalg på kalenderniveau bevidst fravalgt (Nicolaj,
  2026-08-29): aftaleniveau-kontakten ("Privat aftale – familien ser kun
  Optaget") dækker allerede det grundlæggende behov, og et
  kalenderniveau-valg er en ren bekvemmeligheds-udvidelse, ikke en
  sikkerhedsbrist. Tages kun op igen, hvis det opleves som en konkret gene
  i hverdagen.

### Acceptkriterier

- En privat aftales titel, beskrivelse og lokation forlader aldrig den tilladte
  kontekst.
- AI-resumé kan fravælges og modtager aldrig private felter.
- Offentlige links viser mindst mulige data som standard.

**Næste handling:** Ingen — fasen er gennemført. Et kalenderniveau-
privatlivsvalg kan tages op som en selvstændig, ny funktion senere, hvis
behovet opstår.

## Fase 4 – Login, branding og OAuth-klargøring

**Mål:** Login skal se troværdigt ud og kun anmode om de nødvendige Google-
rettigheder med offentligt dokumenteret formål.

**Status: Delvist gennemført**

### Gennemført

- [x] Login-siden bruger produktnavnet “Boholts Familieapp”, ikon og en kort
  produktforklaring.
- [x] Login-siden linker til offentlige sider for privatlivspolitik og vilkår.
- [x] Appnavn og basisbranding er ensrettet i de kodeejede flader.
- [x] De juridiske sider er tilgængelige uden login.
- [x] Gennemgå og dokumentér hvert Google OAuth-scope og fjern eventuelle
  overflødige scopes. Alle fem anmodede scopes
  (`openid`/`email`/`profile`/`calendar.events`/
  `calendar.calendarlist.readonly`) er verificeret mod faktisk kodebrug —
  ingen overflødige fundet (fx bruges bevidst IKKE den bredere `calendar`-
  scope, da appen aldrig opretter/sletter kalendere, kun aftaler). Fandt
  samtidig, at `src/features/calendar/providers/google/README.md` og
  `05_App/web/README.md` beskrev en helt forældet, fjernet arkitektur
  (Sprint 11.1's klient-popup-flow med `VITE_GOOGLE_CLIENT_ID` i
  `.env.local`) — reelt erstattet af det nuværende server-side
  authorization-code+PKCE-flow siden Fase 3, men dokumentationen fulgte
  aldrig med. Begge rettet til at beskrive det faktiske flow, med korrekt
  scope-tabel og opsætningsvejledning. Ren dokumentationsrettelse, ingen
  kodeændring — selv-merget.
- [x] Kontrollér redirect-URI'er for beta og senere produktionsdomæne.
  Verificeret i koden (`server/routes/auth.ts`): `redirect_uri` udregnes
  dynamisk som den indkommende requests eget domæne + `/auth/google/callback`
  — koden er allerede domæneuagtig og kræver INGEN ændring for et nyt
  domæne. Det eneste resterende er en Google Cloud Console-konfiguration
  (tilføj hvert faktisk brugt domæne under "Authorized redirect URIs"),
  som kun Nicolaj kan udføre — se den opdaterede
  `providers/google/README.md` for den præcise fremgangsmåde.

### Mangler

- [ ] Færdiggør Google OAuth-verificering og consent-screen-branding.
  **Status pr. 2026-08-29 (Nicolaj i gang direkte i Google Cloud
  Console):** App-navn rettet til "Boholts Familieapp" (var fejlagtigt
  "Boholts Family Platform"), logo uploadet, scopes registreret og
  justifikation for `calendar.events` udfyldt, appen sat til "In
  production" (ude af Testing-tilstand). **Blokeret på:** Googles
  OAuth-verificering kræver en domæne-niveau-verificering (DNS TXT-record)
  af `nicolajbach12.workers.dev` i Google Search Console — det domæne ejer
  Nicolaj ikke DNS-styringen af (det er Cloudflares delte
  `workers.dev`-zone). En URL-præfiks-verificering af selve beta-adressen
  blev forsøgt som alternativ (Search Console-verificeringen lykkedes,
  `google1e28839311687158.html` tilføjet i `public/`), men Cloud
  Console's "Prepare for verification"-knap forblev gråtonet efter dette —
  tyder på, at kun domæne-niveau-verificering tæller. Kan skyldes
  forsinket synkronisering mellem Google-tjenester (tjekkes igen senere) —
  hvis ikke, er et rigtigt, selv-ejet domæne den reelle løsning, ikke kun
  en teknisk omvej.
- [ ] Sørg for, at Google viser produktnavnet frem for `workers.dev`-domænet.
- [ ] Beslut og konfigurer eventuelt eget verificeret domæne.

### Acceptkriterier

- Google-consent viser korrekt appnavn, ikon, privatlivspolitik og vilkår.
- Ingen ubegrundede OAuth-scopes.
- Login og callback virker på alle godkendte miljøer uden uverificeret-advarsel.

**Ekstern handling:** Den endelige Google-verificering og domæneejerskab skal
godkendes i Google Cloud Console af Nicolaj.

## Fase 5 – Automatiske brugerflowtests

**Mål:** De vigtigste brugerrejser skal testes i en rigtig browser uden
produktionsdata eller private kalenderkonti.

**Status: Gennemført**

### Gennemført

- [x] Playwright er installeret og adskilt fra Vitest.
- [x] CI installerer Chromium og kører E2E-pakken.
- [x] Ikke-logget bruger ser login og kan åbne juridiske sider.
- [x] Mock-autentificeret bruger kan navigere gennem de fem hovedområder på
  desktop og mobil.
- [x] Mobil familieplanner testes for vandret overflow.
- [x] Offline-tilstand og genforbindelse: fire reelle Playwright-tests
  (kalender-cache, indkøb tilføj/ryd afkrydsede, opgave-afkrydsning) — se
  fase 8, gennemført.
- [x] Offentligt kalenderlink og privatlivsvalg: reel E2E af `/share/:token`
  (privat vs. almindelig aftale) samt af opret-dialogens "Privat
  aftale"-kontakt — se fase 3.
- [x] Familie-isolation, delmængde: to nye servertests bekræfter, at et
  medlem af én familie ikke kan omdøbe en anden families navn eller
  regenerere dens invitationskode (`families.test.ts`, PATCH /:id og
  POST /:id/invites/regenerate) — supplerer den eksisterende
  cross-family-dækning på indkøbslister, opgaver og skabeloner.
- [x] Opret, redigér og slet kalenderaftale med mock/testkonto: reel
  Playwright-E2E gennem den rigtige UI (opret via "Ny aftale", redigér
  titlen og gem, bekræft-slet-flowet). **Vigtig arkitektonisk afklaring
  ved samme lejlighed:** "Gentagen aftale samt redigering af
  enkeltforekomst" kan IKKE testes gennem UI'et i denne app i dag — hverken
  "Ny aftale"-dialogens gentagelsesvalg eller redigér-dialogens "Kun denne
  forekomst/Hele rækken"-valg vises for nogen ekstern kalenderkilde
  (Google/Outlook/ICS); begge er kun kodet til en `source: "internal"`,
  som ikke længere findes i produktionskoden siden Fase 5's fjernelse af
  det lokale aftale-lag (ADR-011/012/017,
  `CompositeCalendarProvider.ts`). Punktet er derfor fjernet fra
  "Mangler" nedenfor, ikke løst med en test — der er intet UI-flow at
  teste, før/hvis appen får en rigtig gentagelses-understøttet kilde
  igen.
- [x] Fuldt invitations-/rolle-UI-flow. To dele: (1) en helt ny bruger uden
  familie/localStorage taster en invitationskode ind i
  `FamilySetupOnboarding` og kommer ind i appen — reel Playwright-E2E med
  sin egen mock (`/api/families/mine` starter som `family: null`, så
  onboarding rent faktisk vises, ligesom en ægte ny bruger ville opleve
  det). (2) Rolleadministration havde INGEN UI overhovedet før denne
  ændring — kun serverruter (`POST .../memberships/:userId/role`,
  `DELETE .../memberships/:userId`) uden nogen kaldende komponent.
  Bygget: ny `GET /:id/memberships`-rute (`familyMembers.ts`, læsbar for
  ethvert medlem, samme mønster som kalender-mappings) der joiner
  `family_memberships` med `users` for navn/e-mail/rolle, en ny
  `FamilyMembershipsDialog.tsx` (åbnet fra en ny "Medlemmer og
  roller"-række i `FamilySection.tsx`) der viser familiens KONTI (ikke at
  forveksle med `family_members`-profilerne, som kan være børn uden egen
  konto) med en rolle-dropdown (kun ejeren må ændre, aldrig på egen eller
  ejerens række) og en fjern-knap (ejer/admin, samme begrænsning). Genbruger
  eksisterende, allerede testede serverruter — ingen ny skrivelogik, kun
  den manglende læserute og selve UI'et. 2 nye servertests
  (`families.test.ts`) for den nye liste-rute (synlig for ethvert medlem,
  404 for udenforstående) og 2 nye reelle Playwright-E2E-tests (accept-flow
  gennem `FamilySetupOnboarding`; rolleskift + fjernelse gennem den nye
  dialog). Synlig ny funktion (ny UI-flade) — til gennemgang, ikke
  selv-merget.
- [x] Indkøbsliste, opgaver og rutiner (opret/redigér/slet gennem UI'et) —
  det sidste tilbageværende Fase 5-punkt. 3 nye reelle Playwright-E2E-tests:
  (1) indkøbsliste — tilføj/redigér/slet en vare, samt opret/redigér/slet
  en hel liste (inkl. skift mellem lister via faneblade); (2) opgaver —
  tilføj/redigér/slet en opgave; (3) rutiner — opret og slet en rutine
  (ingen redigér-UI findes for en eksisterende rutine, kun opret/slet —
  arkitektonisk fakta, ikke en mangel). Ren test/dokumentation, ingen
  adfærdsændring, selv-merget efter grøn CI.
- [x] Logout og fuldstændig lokal oprydning, samt en generel API-fejl uden
  for de allerede dækkede offline-scenarier — Fase 5's sidste to punkter.
  Reel Playwright-E2E for logout gennem den rigtige "Log ud"-knap fandt en
  ægte funktionsfejl undervejs: `useSession()` gemmer login-status lokalt i
  hver komponent uden delt context, så logout kun ryddede AccountDataSection's
  egen visning — resten af app-skallen (topmenu, sider) forblev synligt
  logget ind, indtil brugeren selv genindlæste siden. Rettet med et
  `window.location.reload()` efter logout (samme mønster som backup-import
  allerede bruger), godkendt af Nicolaj som en synlig adfærdsændring. Testen
  bekræfter nu: `POST /auth/logout` kaldes, al `localStorage` prefixet
  `boholts-family-` ryddes, og login-siden vises reelt uden manuel
  genindlæsning. Den anden nye test simulerer en ægte 500-fejl fra serveren,
  mens appen ER online (til forskel fra de tre eksisterende
  offline-køet-tests, som dækker manglende netværk) — bekræfter en synlig
  fejlmeddelelse ("Handlingen kunne ikke gennemføres. Prøv igen.") i stedet
  for en tavs fejl eller crash.

### Acceptkriterier

- Kritiske flows kan køres deterministisk i CI uden rigtige secrets eller
  produktionsdata.
- Fejl giver læsbare traces/screenshots, og flaky tests blokerer ikke uden en
  dokumenteret årsag.

**Næste handling:** Ingen — fasen er gennemført.

## Fase 6 – Refaktorering

**Mål:** Reducér ændringsrisiko ved at flytte forretningslogik ud af store
sidekomponenter og opdele serverruter efter ansvar uden adfærdsændringer.

**Status: Gennemført**

### Gennemført

- [x] `CalendarPage.tsx` (1160 linjer) opdelt: al tilstand, afledte
  værdier og handlere flyttet til `useCalendarPageController`
  (`features/calendar/hooks`), og de rene dato-/visningshjælpefunktioner
  flyttet til `calendarPageDateNavigation.ts` med direkte enhedstests.
  Siden selv er nu 473 linjer og koordinerer udelukkende hooket og
  underkomponenter — ingen adfærdsændring, samme JSX-struktur.
- [x] `ShoppingListPage.tsx` (1078 linjer) opdelt: de fire allerede
  selvstændige underkomponenter (`ItemRow`, `TemplateRow`,
  `TemplatesDialog`, `SuggestIngredientsDialog`) flyttet til
  `features/shoppingList/components/`, og de to rene hjælpefunktioner
  (`groupItemsByCategory`, `shareItemsAsText`) flyttet til
  `features/shoppingList/utils/` med direkte enhedstests. Siden selv er
  nu 504 linjer og koordinerer udelukkende `useShoppingList`-hooket og
  underkomponenterne — ingen adfærdsændring.
- [x] `SettingsPage.tsx` (987 linjer) opdelt i fem uafhængige
  sektionskomponenter (`FamilySection`, `CalendarConnectionsSection`,
  `AppNotificationsSection`, `AccountDataSection`, `HelpFeedbackSection`)
  under `features/settings/components/`, hver med sine egne hook-kald
  (ingen prop-drilling nødvendig, da sektionerne ikke deler tilstand).
  Den rene `getProviderConnectionStatusText`-hjælpefunktion flyttet til
  `features/settings/utils/` med direkte enhedstests. Siden selv er nu
  under 30 linjer. Ingen adfærdsændring — verificeret med den fulde
  Playwright-suite (inkl. a11y-navne- og mobilbredde-tests, som begge
  dækker Indstillinger-siden).
- [x] `EditEventDialog.tsx` (983 linjer) opdelt: al tilstand, afledte
  værdier, reset-på-åbn-logik og handlere (submit/slet) flyttet til
  `useEditEventDialogController` (`features/calendar/hooks`). Dialogen
  selv koordinerer nu udelukkende hooket og de allerede eksisterende
  underkomponenter (`EventDateTimeSection`, `EventParticipantsSection`,
  `EventRecurrenceSection`, `EventConflictAlert`, `ConfirmDiscardDialog`)
  — ingen adfærdsændring. Verificeret med den fulde Playwright-suite,
  inkl. den test der specifikt dækker privat-aftale-flowet gennem denne
  dialog.
- [x] `families.ts` (877 linjer, serverrute) opdelt efter ansvar i
  `server/routes/familyRoutes/`: `familyQueries.ts` (delte
  DB-hjælpefunktioner og typer), `familyCore.ts` (oprettelse, `/mine`,
  invitationer, omdøbning), `familyMembers.ts` (medlemmer, roller,
  ejerskifte), `shareLinks.ts`, `familySettings.ts`
  (ugeresumé/privatlivsvalg) og `calendarMappings.ts`. `families.ts`
  selv er nu blot en komponist: auth-middleware + fejlhåndtering,
  derefter fem `.route("/", ...)`-monteringer — samme mønster som
  `server/index.ts` allerede bruger til at samle alle rutefiler. Ingen
  adfærdsændring — verificeret med den eksisterende
  `families.test.ts` (1039 linjer, dækker alle ruter end-to-end via
  Hono's `.request()`) uændret, samt fuld Playwright-suite.
- [x] `shoppingLists.ts` (741 linjer, serverrute) opdelt efter ansvar i
  `server/routes/shoppingListRoutes/`: `shoppingListQueries.ts` (delte
  DB-hjælpefunktioner og typer), `lists.ts` (liste-CRUD), `items.ts`
  (vare-CRUD, AI-ingrediens-udkast, ryd afkrydsede) og `templates.ts`
  (skabelon-CRUD). `shoppingLists.ts` selv er nu blot en komponist —
  samme mønster som `families.ts`. Ingen adfærdsændring — verificeret
  med den eksisterende `shoppingLists.test.ts` (1216 linjer) uændret,
  samt fuld Playwright-suite.
- [x] `tasks.ts` (666 linjer, serverrute) opdelt efter ansvar i
  `server/routes/taskRoutes/`: `taskQueries.ts` (delte DB-hjælpefunktioner
  og typer, inkl. `materializeTasksForDate` og `notifyForTask`, som
  `server/lib/taskReminders.ts` og `server/lib/weeklySummary.ts` allerede
  importerer), `tasksCrud.ts` (opgave-CRUD, ryd udførte) og
  `taskRoutines.ts` (rutine-CRUD, AI-udkast). `tasks.ts` selv er nu blot
  en komponist og re-eksporterer de to funktioner, så de to eksterne
  importstier forblev uændrede. Ingen adfærdsændring — verificeret med
  den eksisterende `tasks.test.ts` (770 linjer) uændret, samt fuld
  Playwright-suite.

### Acceptkriterier

- Sider koordinerer primært mindre komponenter og hooks.
- Serverruter er opdelt efter ansvar.
- Refaktorering og ny funktionalitet blandes ikke i samme PR.
- Eksisterende adfærd og tests bevares; flyttet logik får direkte tests.

Alle store side- og rutefiler identificeret ved fasens start er nu
opdelt efter ansvar, uden adfærdsændring, og fasens acceptkriterier er
opfyldt. Yderligere, mindre udflytning af validering/forretningslogik
til services/hooks kan fortsat ske løbende i almindelige PR'er — det
er en vedvarende kodekvalitetspraksis, ikke en resterende blokering for
denne fase.

## Fase 7 – Release, drift og dokumentation

**Mål:** Hver deploy skal kunne spores, kvalitetssikres, migreres og rulles
tilbage uden at være afhængig af tavs manuel viden.

**Status: Delvist gennemført**

### Gennemført

- [x] Health-endpoint og Indstillinger viser aktiv Cloudflare-version.
- [x] Cloudflare-observability er reelt aktiveret.
- [x] Serverfejl logges struktureret uden rå, potentielt følsomme push-svar.
- [x] Worker-bindingstyper genereres og kontrolleres i CI.
- [x] GitHub Actions kvalitetstjekker lint, build, tests og E2E før beta-deploy.
- [x] D1-migrationsregisteret er baselinet, og migrationer kan anvendes
  reproducerbart.
- [x] D1 Time Travel-gendannelsespunkt blev taget før migrationsarbejdet.
- [x] Arkitekturdokumentation er rettet fra gammel localStorage/single-device-
  beskrivelse til Worker, D1, sessioner, krypterede tokens, push, cron og AI.
- [x] `main` og `develop` er beskyttet: PR-krav med mindst 1 godkendelse,
  påkrævet grøn `Lint, build and test`-check, branch skal være up to date
  før merge, ingen bypass for nogen — inkl. repository-ejeren. Ingen direkte
  push til `main` (eller `develop`) er længere muligt.
- [x] `PROJECT_STATUS.md` gennemgået og rettet for modstridende status
  (forældet testtal, ufuldstændig Fase 6-beskrivelse). Roadmap,
  kravsporbarhed, release-baseline og Sprint 29-planen blev tidligere rettet
  i PR #115 og er stadig konsistente.
- [x] D1 backup/restore-runbook dokumenteret i
  `13_Release_And_Security_Baseline.md` med præcis `wrangler d1 time-travel
  info`/`restore`-kommandosyntaks (verificeret mod den installerede
  CLI's `--help`), 30-dages-vinduet og en eksplicit advarsel om at
  gendannelsen er destruktiv og aldrig må køres mod produktion uden
  Nicolajs accept. Selve gendannelses**øvelsen** (at faktisk køre
  `restore` og bekræfte resultatet) er bevidst ikke udført autonomt — det
  er en skarp handling på en database med rigtige brugeres data, og afventer
  et aftalt tidspunkt med Nicolaj.
- [x] Cloudflares gamle native Git-deploy er slået fra af Nicolaj i
  dashboardet (2026-08-29). Kun den kvalitetssikrede GitHub Actions-pipeline
  deployer nu beta og produktion — de to tidligere, konstant fejlende
  "Workers Builds"-tjek på hver PR bortfalder herefter.

### Mangler

- [ ] Udfør selve D1-gendannelsesøvelsen (kør `time-travel restore` og
  bekræft resultatet) — kræver et aftalt tidspunkt med Nicolaj, se ovenfor.
- [ ] Definér og udfør kontrolleret release fra `develop` til `main`, når de
  lanceringskritiske faser er opfyldt.

### Acceptkriterier

- Præcis commit, miljø, Worker-version og migrationsstatus kan spores.
- Ingen kode deployes til beta før grøn kvalitetskontrol.
- Releasechecklisten dækker deploy, migration, health, smoke-test og rollback.
- `main` kan ikke ændres direkte uden den aftalte kontrol.

**Ekstern handling:** Ingen tilbage for selve deploy-pipelinen — Cloudflare
Git-integration er slået fra. D1-gendannelsesøvelsen og release til `main`
kræver stadig et aftalt tidspunkt med Nicolaj.

## Fase 8 – Offlineoplevelse

**Mål:** Appen skal kommunikere ærligt om offline-tilstand og senere kunne
håndtere udvalgte læse- og skriveflows uden at cache følsomme credentials.

**Status: Gennemført**

### Gennemført

- [x] Appen viser offline- og genforbindelsesstatus.
- [x] Teksten i appen kommunikerer offline-tilstanden korrekt: der caches
  read-only kalenderdata, og udvalgte indkøbs-/opgaveændringer køes lokalt
  og synkroniseres ved genforbindelse (se skrivekø-punkterne nedenfor).
- [x] PWA-appskallen caches.
- [x] Auth, tokens og følsomme API-svar er ikke tilføjet til service-worker-
  cache.
- [x] Offline-datapolitik skrevet:
  `01_Project_Documentation/Development/31_Offline_Data_Policy.md`.
  Definerer præcist hvad der aldrig må caches (auth/tokens, urediegeret
  privat aftaledata), hvad der må caches til read-only offline-visning
  (kalender/indkøb/opgaver, 7 dages TTL, alder synlig for brugeren, ryddes
  ved logout — bygger videre på den eksisterende kalender-sync-cache fra
  Sprint 25), hvilke skrivninger der må køes offline i første omgang
  (indkøbsvare tilføj/af-tilkryds, opgave af-tilkryds — bevidst afgrænset
  til lavrisiko append/toggle-handlinger) og et simpelt konfliktprincip for
  dem (drop den enkelte køede ændring med en synlig besked, hvis dens mål er
  slettet i mellemtiden). Selve skrivekø-implementeringen er nu gennemført
  for hele politikkens skriveliste, jf. de følgende punkter.
- [x] Read-only offline-kalendervisning implementeret efter politikken:
  `googleCalendarSyncCacheStorage.ts` stempler nu hver cache-post med
  `updatedAt`; `GoogleCalendarProvider.getEvents()` falder tilbage til den
  lokale cache (kun poster ≤ 7 dage gamle, jf. politikkens TTL) ved en
  netværksfejl i stedet for at fejle helt, og eksponerer hvornår den
  viste cache er fra via `getOfflineCacheAsOf()`. `CompositeCalendarProvider`
  og `CalendarProviderHealth` bærer dette videre som `staleDataAsOf`, og
  `ExternalCalendarConnectionBanner` viser en synlig "viser gemte aftaler
  fra ..."-besked, når det sker — intet vises tavst som live data.
  Er cachen for gammel, eller findes den slet ikke, kastes netværksfejlen
  videre uændret (samme adfærd som før denne PR). Afgrænset til Google
  (den eneste provider med en eksisterende lokal cache i dag) —
  Outlook-fallback er ikke en del af dette skridt. Ændrer appens faktiske
  funktion/oplevelse offline — derfor bevidst ikke selv-merget; godkendt og
  merget af Nicolaj (PR #125).
- [x] Skrivekø til indkøbslistens vare-tilføjelse og af-/tilkrydsning
  (første, bevidst afgrænsede skive af politikkens fulde skriveliste):
  `offlineShoppingQueueStorage.ts` (ny, localStorage-baseret kø, samme
  mønster som resten af appen — "IndexedDB" i politikteksten var en
  arbejdstitel for "lokal skrivekø", ikke et krav om den specifikke
  teknologi). `useShoppingList.ts`'s `addItem`/`toggleChecked` køer
  ændringen ved en netværksfejl i stedet for blot at vise en generisk
  fejl; af-/tilkrydsning er optimistisk (varen findes allerede lokalt, så
  ingen id-forening nødvendig), tilføjelse er det bevidst ikke (undgår at
  skulle forene et midlertidigt lokalt id med serverens rigtige bagefter).
  Køen afspilles automatisk (FIFO) ved "online"-hændelsen og ved skift af
  liste; et 404 (mål slettet) dropper netop den ændring med en synlig
  besked og fortsætter resten, jf. politikkens konfliktprincip; enhver
  anden fejl stopper afspilningen uden at fjerne resten. Et synligt "N
  ændringer er gemt lokalt..."-banner opfylder acceptkriteriets krav om, at
  brugeren tydeligt kan se det. Verificeret med en ny, reel Playwright-test
  (`offline shopping list add is queued locally and syncs on reconnect`),
  som simulerer en mislykket netværksforbindelse og bekræfter både
  kø-tilstanden og den efterfølgende synkronisering — ikke kun enhedstests
  af den isolerede logik. **Afgrænset bevidst fra:** "ryd afkrydsede"
  (nævnt i politikken, men udskudt), rediger/slet-vare (allerede uden for
  politikkens skriveliste), og opgaver (Tasks) — alle tre er en
  efterfølgende, selvstændig PR, samme mønster. Ændrer appens faktiske
  funktion/oplevelse offline — derfor bevidst ikke selv-merget; godkendt og
  merget af Nicolaj (PR #127).
- [x] Skrivekø til opgavers af-/tilkrydsning, samme mønster som ovenfor:
  `offlineTaskQueueStorage.ts` (ny, localStorage-baseret — ikke slået
  sammen med `offlineShoppingQueueStorage.ts` til én delt abstraktion, da
  opgaver kun har denne ene tilladte operationstype og er scopet pr. dato,
  ikke pr. liste — de to domæner deler ikke nok struktur til at gøre en
  fælles kø enklere end to små, selvstændige moduler).
  `useTasks.ts`'s `toggleDone` er optimistisk og køer ved en netværksfejl;
  samme FIFO-afspilning ved "online"-hændelsen, samme 404-droppes-med-
  besked-konfliktregel, samme synlige "N ændringer er gemt lokalt..."-
  banner på Opgaver-siden. Verificeret med en ny, reel Playwright-test
  (`offline task toggle is queued locally and syncs on reconnect`), som
  bevidst kun lader selve afkrydsnings-PATCH'et fejle (ikke en global
  offline-tilstand) for at undgå den race mod andre samtidige
  familiedata-kald, som gjorde en tidligere version af
  indkøbsliste-testen flaky. Ændrer appens faktiske funktion/oplevelse
  offline — derfor bevidst ikke selv-merget; godkendt og merget af Nicolaj
  (PR #129).
- [x] Skrivekø udvidet til "ryd afkrydsede" på indkøbslisten — samme
  mønster som de øvrige operationer: `offlineShoppingQueueStorage.ts` fik
  en tredje operationstype (`clear-checked`), `clearChecked` i
  `useShoppingList.ts` er optimistisk og køer ved en netværksfejl, samme
  FIFO-afspilning/404-konfliktregel. Med denne er alle operationer nævnt i
  `31_Offline_Data_Policy.md`'s skriveliste nu understøttet (indkøb:
  tilføj/af-tilkryds/ryd afkrydsede; opgaver: af-tilkryds). Verificeret med
  endnu en reel Playwright-test
  (`offline shopping list clear-checked is queued locally and syncs on
  reconnect`), samme afgrænsede fejlsimulering som de to øvrige
  offline-tests. Godkendt og merget af Nicolaj (PR #132).
- [x] Dedikeret Playwright-offline-test for kalendervisnings-fallbacket
  (PR #125), som hidtil kun var verificeret med provider-/lagrings-
  enhedstests: `offline calendar shows cached events with a visible
  staleness banner` besøger `/calendar` online (fylder sync-cachen),
  genindlæser siden med kun selve aftale-hentningen fejlende, og bekræfter
  både at den cachede aftale stadig vises og at "viser gemte aftaler
  fra..."-beskeden er synlig — samt at begge forsvinder igen, når
  forbindelsen er tilbage. Ren test, ingen adfærdsændring — selv-merget.

Alle tre skrivekø-flows og kalendervisnings-fallbacket har nu hver sin
egen reelle Playwright-verifikation, og fasens acceptkriterier nedenfor er
opfyldt.

### Fremtidige forbedringer (ikke en del af fasens acceptkriterier)

Fasens acceptkriterier er alle opfyldt — ingen af nedenstående er en
mangel i Fase 8. De er mulige, ikke-blokerende udvidelser til en senere
sprint, hvis der opstår behov:

- Offline redigering/sletning af kalenderaftaler, indkøbsvarer eller
  opgaver ud over den nuværende append/toggle-skriveliste.
- Et Outlook-offline-fallback svarende til Googles (kun Google har i dag en
  lokal cache at falde tilbage på).

Begge kræver en ny politikbeslutning i
`31_Offline_Data_Policy.md` først, ikke kun kode.

### Acceptkriterier

- Brugeren kan tydeligt se netværkstilstanden og om en handling er gemt lokalt
  eller på serveren.
- Ingen OAuth-data, sessionscookies eller følsomme API-svar caches.
- Køede ændringer synkroniseres deterministisk eller giver en forståelig
  konfliktbesked.

**Næste handling:** Ingen resterende punkter inden for fasens nuværende
acceptkriterier. En fremtidig udvidelse af skrivekøen (se "Fremtidige
forbedringer" ovenfor) kræver en ny politikbeslutning, før den påbegyndes.

## Fase 9 – ICS-abonnementskalendere

**Mål:** Et familiemedlem skal kunne tilføje en delt kalender via et ICS-link
(fx Googles "hemmelige iCal-adresse", Outlooks offentlige kalenderlink, en
skole- eller idrætskalender) og se dens aftaler i appen, uden at skulle logge
ind på den konto, kalenderen tilhører. Skrivebeskyttet — appen redigerer
aldrig i en ICS-kilde.

**Status: Gennemført**

### Gennemført

- [x] D1-migration `0018_ics_calendar_subscriptions.sql`: ny tabel med
  familyId, url (klartekst, jf. beslutning nedenfor), label,
  familyMemberId (valgfri), createdByUserId, lastFetchedAt,
  lastFetchStatus, createdAt.
- [x] Server-CRUD for abonnementer (`server/routes/familyRoutes/
  icsSubscriptions.ts`, mountet i `families.ts`): list (alle medlemmer),
  opret/redigér/slet (kun ejer/admin), med samme cross-family-tjek af
  `familyMemberId` som `calendarMappings.ts`. Validerer kun URL-skema
  (http/https) — reel nåbarheds-/SSRF-kontrol hører til den kommende
  hentnings-rute, hvor der rent faktisk sker et netværkskald.
- [x] 5-abonnements-loftet håndhæves server-side (409 ved forsøg på et
  sjette). 11 nye servertests dækker opret/list/redigér/slet, loftet,
  rolle-tjek og cross-family-isolation. Rent backend — ingen UI eksponerer
  endnu disse ruter, så ingen ændring i appens brug eller udseende;
  selv-merget.
- [x] `server/lib/icsCalendar.ts`: SSRF-hærdet hentning (kun http/https,
  blokerer literal private/loopback/link-local IPv4/IPv6-adresser inkl.
  cloud-metadata-IP'en 169.254.169.254, `localhost`/`.local`, 10s timeout,
  2 MB svarloft via streaming-læsning i stedet for at stole på
  Content-Length, op til 3 omdirigeringer hvor HVER ny URL genvalideres —
  ikke kun den oprindelige). Bruger `ical.js` (ingen afhængigheder, ren
  ESM, ingen Node-specifikke API'er — bekræftet ved en `wrangler
  versions upload --dry-run`, som bundlede Workeren uden fejl) til både
  ICS-parsing og RRULE-udfoldning i ét bibliotek, med samme
  forekomstsloft-filosofi (500) som `expandRecurringEvents.ts`s eget
  730-loft. `server/lib/icsCalendarPrivacy.ts` redigerer `CLASS:PRIVATE`/
  `CONFIDENTIAL`-aftaler til "Optaget", samme princip som
  `googleCalendarPrivacy.ts`.
- [x] Ny rute `GET /:id/ics-subscriptions/:subscriptionId/events` henter og
  parser abonnementets feed for et givent tidsrum og opdaterer altid
  `lastFetchedAt`/`lastFetchStatus` (også ved fejl), så familien kan se om
  en kilde svarer. 3 nye ruttests + 37 nye enhedstests af
  `icsCalendar.ts` (SSRF-blokering, parsing, privatliv, RRULE,
  omdirigering, størrelsesloft). Ingen UI kalder endnu denne rute.
- [x] UI i Indstillinger (`IcsSubscriptionsPanel.tsx`): oprindeligt sin egen
  selvstændige dialog, siden flyttet ind i den eksisterende
  "Kalenderforbindelser"-dialog (`CalendarConnectionsSection.tsx`), efter
  ønske fra Nicolaj — samlet ét sted med Google/Outlook i stedet for en
  ekstra række i Indstillinger. Viser eksisterende abonnementer (navn,
  tildelt medlem, sidst hentet-status) og en formular til at tilføje et
  nyt (navn, ICS-link, valgfri medlemstildeling), med fejlvisning og
  loft-besked fra API'et. E2E-testen for at tilføje/fjerne et abonnement er
  opdateret til den nye placering. Godkendt visuelt af Nicolaj ud fra
  rigtige skærmbilleder, før koden blev committet.
- [x] Placeringen justeret endnu en gang, efter yderligere ønske fra
  Nicolaj: "Delte kalendere (ICS)" er nu sin EGEN række i
  "Kalenderforbindelser"-dialogen — genbruger `ProviderConnectionRow`,
  samme visuelle niveau som Google/Outlook-rækkerne (ny `actionAriaLabel`-
  prop på komponenten, da rækken åbner en administrationsdialog, ikke en
  konto-forbind/afbryd-handling) — i stedet for at være indlejret direkte
  i selve Kalenderforbindelser-dialogens indhold. Klik åbner en ny,
  dedikeret `IcsSubscriptionsDialog.tsx` med samme `IcsSubscriptionsPanel`-
  indhold som før. Samtidig tilføjet: redigering af et eksisterende
  abonnements navn og medlemstildeling (blyant-ikon pr. række, inline
  redigeringsformular; ikke selve ICS-linket, jf. Nicolajs afgrænsning),
  via den allerede eksisterende PATCH-rute og `updateIcsSubscription`-
  klientfunktion (begge fra PR #138/#141, ingen ny backend-kode). E2E-
  testen udvidet til at dække redigér-flowet. Godkendt visuelt af Nicolaj
  ud fra rigtige skærmbilleder.
- [x] Klient-integration: `IcsCalendarProvider` (`providers/ics/
  IcsCalendarProvider.ts`) implementerer `CalendarProvider` og kalder
  `/events`-ruten (PR #139); registreret i `CompositeCalendarProvider` med
  `sourceIdPrefix: "ics:"`. Skrivemetoder kaster ubetinget (`"Delte
  ICS-kalendere er skrivebeskyttede."`), samme mønster som Google/Outlooks
  `restoreEvent()`. Ny `CalendarProviderType`/`CalendarEventSource`-værdi
  `"ics"` tilføjet. `icsCalendarSyncCacheStorage.ts` er den primære
  friskhedsstrategi (15 min. opdateringsvindue, 7 dages offline-fallback,
  jf. 31_Offline_Data_Policy.md) — springer selve netværkshentningen over,
  når cachen er frisk nok, i stedet for at hamre eksterne ICS-servere ved
  hver kalendervisning. Fejl isoleres pr. abonnement: én ubesvarende kilde
  skjuler ikke familiens øvrige delte kalendere. Et tilføjet abonnement
  vises nu med sine aftaler i selve kalenderen, tildelt medlemmets
  farve/kolonne hvis tildelt. Verificeret med `npm run build` (typecheck),
  519 grønne Vitest-tests og fuld grøn Playwright-suite (14 tests,
  desktop-chromium, inkl. WCAG-audit). Synlig ny funktion (aftaler fra en
  delt kalender vises nu i appen) — til gennemgang, ikke selv-merget.
- [x] Valgfri farve pr. ICS-abonnement, efter ønske fra Nicolaj. Ny
  nullable `color`-kolonne (migration 0019, ingen format-/enum-tjek,
  samme princip som `family_members.color`); accepteret af POST/PATCH i
  `icsSubscriptions.ts`. UI'et genbruger `FamilyMemberDialog.tsx`s
  faste 8-farve-swatch-vælger (`familyMemberColorSwatches.ts`) i både
  tilføj- og redigér-formularen — vist KUN når intet familiemedlem er
  tildelt, da et tildelt medlems egen farve altid vinder
  (`icsCalendarMapper.ts`: `mappedOwner?.color ?? subscription.color ??
  fallbackColor`). Godkendt visuelt af Nicolaj ud fra skærmbilleder.
  Synlig ny funktion — til gennemgang, ikke selv-merget.

### Beslutninger truffet (2026-08-28, Nicolaj)

- URL'en gemmes i klartekst i D1 for v1 — ikke krypteret som Googles
  OAuth-token. Kan tilføjes senere, hvis en sikkerhedsgennemgang anbefaler
  det; krypteringshjælperen i `server/lib/tokenEncryption.ts` (AES-GCM) er
  allerede generisk nok til at genbruge, hvis det bliver aktuelt.
- Et ICS-abonnement kan tildeles et familiemedlem, ligesom en Google-/
  Outlook-kalender — vises med medlemmets navn/farve og indgår i personens
  kolonne i familieplanleggeren, ikke kun som en løsrevet ekstra kilde.
- En familie kan have højst 5 ICS-abonnementer ad gangen (håndhæves
  server-side), for at holde UI'et overskueligt og begrænse
  proxy-udnyttelse.

### Genanvendelige mønstre (fra research forud for denne fase)

- `CalendarProvider`-interfacet kræver ingen ændring — en ny
  `IcsCalendarProvider` implementerer det som Google/Outlook, med
  create/update/delete/restore der kaster (samme mønster som
  `assertWritableSource()` og de eksisterende providers' skrivebeskyttede
  `restoreEvent()`).
- `CompositeCalendarProvider` kræver ingen ændring — registreres blot som
  endnu en `external`-indgang med sin egen `sourceIdPrefix` (fx `"ics:"`).
- Fase 8's offline-cache-mønster (`googleCalendarSyncCacheStorage.ts`s
  TTL/friskhed/oversigt) genbruges til selve hentnings-cachen — uden
  sync-token-halvdelen, som er Google-specifik. Her er cachen den primære
  friskhedsstrategi (ikke kun et offline-fallback), da et ICS-link ikke har
  nogen delta-synk-API.
- Servertets rute-skelet (Hono-underrouter + `.onError()` + `logError`, jf.
  `server/routes/calendar.ts`/`publicCalendar.ts`) genbruges til den nye
  proxy-rute.
- `googleCalendarPrivacy.ts`s koncept — ikke koden — genbruges: ICS'
  `CLASS`-felt (`PUBLIC`/`PRIVATE`/`CONFIDENTIAL`, RFC 5545 §3.8.1.3) er den
  direkte pendant til Googles `visibility`. Ikke en stærk garanti på samme
  niveau som Google/Outlook, da mange offentlige ICS-feeds slet ikke sætter
  feltet (og dermed reelt er offentlige) — skal kommunikeres tydeligt i
  UI'et, ikke stilles som en garanti appen ikke kan indfri.

### Acceptkriterier

- Et gyldigt ICS-link kan tilføjes, og dets aftaler (inkl. gentagne, via
  RRULE) vises korrekt i kalenderen inden for få minutter.
- Et ugyldigt eller utilgængeligt link giver en tydelig fejl, ikke en tavs
  tom kalender.
- Serverens proxy kan ikke misbruges til at nå interne/private IP-adresser
  eller andre Cloudflare-interne ressourcer (SSRF).
- ICS-kilder er altid skrivebeskyttede i appens UI — intet forsøg på at
  redigere/slette en ICS-hentet aftale lykkes.
- En familie kan ikke oprette mere end 5 ICS-abonnementer.
- Aftaler markeret `CLASS:PRIVATE`/`CONFIDENTIAL` redigeres på samme måde
  som private Google-/Outlook-aftaler, med en synlig forbeholdstekst om, at
  garantien afhænger af, om kildekalenderen rent faktisk sætter feltet.

**Næste handling:** Ingen — fase 9 er gennemført. Klient-integrationen
(`IcsCalendarProvider`) ændrer reel funktion (aftaler fra en delt kalender
vises nu i selve kalenderen) og er til gennemgang hos Nicolaj, ikke
selv-merget.

## Prioriteret udførelsesrækkefølge

Arbejdet fortsætter autonomt i denne rækkefølge, med grøn CI efter hver
afgrænset PR:

1. Færdiggør fase 1: event-identitet/dubletter og kalenderens måned/uge-UX.
2. Færdiggør fase 2's automatiserbare tilgængeligheds- og mobilkontroller.
3. Implementér fase 3's privat-aftale/redaktionslag.
4. Udbyg fase 5 med kritiske CRUD-, rettigheds- og privatlivsflows.
5. Opdel de største filer i rene refaktor-PR'er (fase 6).
6. Færdiggør drift/runbooks og eliminér dobbelt deploy (fase 7).
7. ~~Implementér den aftalte offline-datapolitik og tests (fase 8).~~
   Gennemført — se fase 8 ovenfor.
8. Afslut Google OAuth-verificering og fysisk enhedstest, og frigiv derefter
   kontrolleret fra `develop` til `main`.
9. Implementér fase 9's ICS-abonnementskalendere (ny, uafhængig funktion —
   blokerer ikke øvrige punkter og kan foregå parallelt).

Eksterne handlinger eller reelle produktvalg må ikke blokere uafhængigt
arbejde; de samles i afsnittet nedenfor og tages til sidst.

## Åbne eksterne handlinger og beslutninger

| Punkt | Hvorfor det ikke løses alene i kode | Midlertidig håndtering |
|---|---|---|
| ~~Slå Cloudflare native Git-deploy fra~~ | Gjort af Nicolaj 2026-08-29 | — |
| Google OAuth-verificering | Kræver Google Cloud-ejergodkendelse | Login/jura og branding er kodeklargjort |
| Eget produktionsdomæne | Domæne- og produktbeslutning | Beta fortsætter på `workers.dev`; kan også blive nødvendigt for at fuldføre Google-domæneverificeringen (se Fase 4) |
| ~~Fysisk iPhone/VoiceOver~~ | Udført af Nicolaj 2026-08-29 | — |

## Definition of Done for offentlig lancering

- [ ] Fase 1-5 og 7 opfylder alle lanceringskritiske acceptkriterier.
- [ ] Ingen kendte læk af private aftaledata til familie, delelink, push eller
  AI.
- [ ] OAuth-consent er verificeret og viser korrekt brand.
- [ ] Kritiske brugerflows er grønne i browser-CI.
- [ ] Beta er manuelt smoke-testet på iPhone og desktop efter sidste migration.
- [ ] Rollback og D1-gendannelse er dokumenteret og prøvet.
- [ ] Release-PR fra `develop` til `main` er grøn og godkendt.

## Vedligeholdelsesprocedure

Efter hver fase eller material ændring skal den ansvarlige:

1. Opdatere dato, fase-status, afkrydsninger og næste handling i dette dokument.
2. Tilføje evidens i form af PR, commit, CI-kørsel, deploy-version eller manuel
   test.
3. Flytte nye eksterne blokeringer til den samlede beslutningsliste i stedet
   for at standse uafhængige opgaver.
4. Køre de relevante kvalitetstjek og dokumentere eventuelle undtagelser.
5. Opdatere ændringsloggen nedenfor.

## Ændringslog

| Dato | Ændring | Evidens |
|---|---|---|
| 2026-08-26 | Samlet stabilisering: kalenderfordeling, AI-fravalg, jura, version, logs, offline-status og Playwright | PR #102 |
| 2026-08-27 | D1-register baselinet, migration 0017 anvendt, GitHub Actions beta-pipeline verificeret | GitHub Actions #301 |
| 2026-08-27 | Mobil familieplanner erstattet af agenda og beskyttet mod overflow | PR #103 |
| 2026-08-27 | Denne autoritative udførelses- og statusplan oprettet | PR #104 |
| 2026-08-27 | Stabil event-deduplikering og mere læsbar måned/uge-visning | PR #105 |
| 2026-08-27 | Automatisk kontrol af tilgængelige navne og mobilbredder; navngav pushkontakt | PR #106 |
| 2026-08-27 | Privat-aftale-redaktion for familievisning, delelink, AI og push | PR #107 |
| 2026-08-27 | `main` og `develop` beskyttet: PR + 1 godkendelse + grøn CI påkrævet, ingen bypass | GitHub branch protection rules (repo-indstilling) |
| 2026-08-27 | Fase 6 påbegyndt: `CalendarPage.tsx` opdelt i controller-hook + testede hjælpefunktioner | PR #110 |
| 2026-08-27 | En automatisk oprettet `develop → main`-PR (#111) lukket uden merge — for tidligt jf. lanceringskriterierne ovenfor; en bevidst release-PR oprettes i stedet, når fase 1-5 og 7 er lanceringsklare | PR #111 (closed, unmerged) |
| 2026-08-27 | Baseline-tal ajourført (commit-hash, seneste grønne pipeline), og fastfrosne, hurtigt forældede værdier (Cloudflare-version, ældre pipeline-nummer) erstattet med henvisning til deres levende kilde | PR #113 |
| 2026-08-27 | Privat-kontakt ved opret/redigér og provider-lagring (genoprettet på frisk branch, da PR #108's CI aldrig blev trigget — se Lessons Learned) | PR #114 |
| 2026-08-27 | Roadmap, kravsporbarhed, release-baseline og Sprint 29-planen rettet for modstridende status | PR #115 |
| 2026-08-27 | Fase 6: `ShoppingListPage.tsx` opdelt i fire underkomponenter + testede hjælpefunktioner | PR #116 |
| 2026-08-27 | Fase 6: `SettingsPage.tsx` opdelt i fem sektionskomponenter + testet hjælpefunktion | PR #117 |
| 2026-08-27 | Fase 6: `EditEventDialog.tsx` opdelt i controller-hook | PR #118 |
| 2026-08-27 | Fase 6: `families.ts` opdelt i seks ansvarsafgrænsede filer under `server/routes/familyRoutes/` | PR #119 |
| 2026-08-27 | Fase 6: `shoppingLists.ts` opdelt i fire ansvarsafgrænsede filer under `server/routes/shoppingListRoutes/` | PR #120 |
| 2026-08-27 | Fase 6: `tasks.ts` opdelt i tre ansvarsafgrænsede filer under `server/routes/taskRoutes/` — fase 6 gennemført | PR #121 |
| 2026-08-27 | `PROJECT_STATUS.md` rettet for forældet testtal og ufuldstændig Fase 6-status | PR #122 |
| 2026-08-27 | Fase 7: D1 backup/restore-runbook dokumenteret (Time Travel-kommandoer, 30-dages-vindue, destruktivitetsadvarsel) | PR #123 |
| 2026-08-27 | Fase 8: Offline-datapolitik skrevet (`31_Offline_Data_Policy.md`) — hvad der aldrig/må caches, TTL, hvilke skrivninger må køes, konfliktprincip | PR #124 |
| 2026-08-27 | Fase 8: Read-only offline-kalendervisning (Google, 7-dages-TTL, synlig "sidst opdateret") — godkendt og merget af Nicolaj efter gennemgang | PR #125 |
| 2026-08-27 | Fase 8: Skrivekø til indkøbslistens tilføj/af-tilkryds vare, med reel Playwright-offline-test — godkendt og merget af Nicolaj efter gennemgang | PR #127 |
| 2026-08-27 | Fase 8: Skrivekø til opgavers af-/tilkrydsning, med reel Playwright-offline-test — godkendt og merget af Nicolaj efter gennemgang | PR #129 |
| 2026-08-28 | Fase 8: Skrivekø til indkøbslistens "ryd afkrydsede" (sidste punkt fra politikkens skriveliste), med reel Playwright-offline-test — godkendt og merget af Nicolaj efter gennemgang | PR #132 |
| 2026-08-28 | Fase 8: Playwright-offline-test for kalendervisnings-fallbacket (PR #125) — ren test, ingen adfærdsændring, selv-merget. Fase 8 gennemført | PR #133 |
| 2026-08-28 | Fase 2: Automatisk WCAG 2.0/2.1 A/AA-audit (axe-core) indført; navigationslistens semantik og tre marginale kontrastbrud rettet — synlig farveændring, til gennemgang, ikke selv-merget | PR #134 |
| 2026-08-28 | Fase 8: Ryddet modstridende tekst om, at offline-skrivning/skrivekøen "endnu ikke er implementeret/påbegyndt" (forældet efter PR #125-#133); flyttet fremtidige udvidelser (offline redigering/sletning, Outlook-fallback) fra "Mangler" til et separat "Fremtidige forbedringer"-afsnit — ren dokumentation, selv-merget efter grøn CI | PR #135 |
| 2026-08-28 | Fase 3/5: Reel Playwright-E2E for privat-aftale-redaktion (ejer/andet medlem + offentligt delelink), servertests for AI-ugeresumé-redaktion, manglende kalender-kortlægning og cross-family-isolation på familie-omdøbning/invitationsregenerering — ren test/dokumentation, ingen adfærdsændring | PR #137 |
| 2026-08-28 | Fase 9 oprettet: ICS-abonnementskalendere. Omfang undersøgt (genanvendelige mønstre vs. reelt nyt arbejde) og tre produktbeslutninger truffet af Nicolaj (ingen URL-kryptering i v1, tildeles et familiemedlem, loft på 5 abonnementer pr. familie) — ren planlægning/dokumentation, ingen kode endnu | PR #138 |
| 2026-08-28 | Fase 9: D1-migration + server-CRUD for ICS-abonnementer (opret/list/redigér/slet, rolle-tjek, cross-family-isolation, 5-loft) — rent backend, ingen UI endnu, ingen ændring i appens brug/udseende, selv-merget sammen med scope-dokumentationen | PR #138 |
| 2026-08-28 | Fase 9: SSRF-hærdet ICS-hentning/-parsing + RRULE-udfoldning (`server/lib/icsCalendar.ts`, `ical.js`) og en ny hentnings-rute, med privatlivsredaktion for `CLASS:PRIVATE`/`CONFIDENTIAL`. 40 nye tests. Ændrer reel funktion (nye udgående netværkskald, ny afhængighed) — til gennemgang, ikke selv-merget | PR #139 |
| 2026-08-28 | Fase 9: UI i Indstillinger til at tilføje/fjerne delte ICS-kalendere og tildele dem et familiemedlem — synlig ny funktion, godkendt visuelt af Nicolaj ud fra skærmbilleder før commit. Viser endnu ikke aftalerne i selve kalenderen (kræver klient-provider-integrationen, se Fase 9 "Ny arbejde") | PR #140 |
| 2026-08-28 | Fase 9: Klient-integration (`IcsCalendarProvider` registreret i `CompositeCalendarProvider`, ny `"ics"`-kildetype, primær friskheds-cache) — tilføjede delte kalendere vises nu i selve kalenderen. ICS-panelet flyttet ind i den eksisterende "Kalenderforbindelser"-dialog i stedet for sin egen, efter ønske fra Nicolaj. Fase 9 gennemført. Synlig ny funktion — til gennemgang, ikke selv-merget | PR #141 |
| 2026-08-28 | Fase 2: Automatiseret tastatur-/fokusgennemgang som faste Playwright-tests (venstremenuens fulde Tab-rækkefølge på alle fem hovedsider + en Indstillinger-dialogs fokusfælde/Escape-genoprettelse) — ingen fejl fundet, ren test, ingen adfærdsændring, selv-merget efter grøn CI | PR #142 |
| 2026-08-28 | Fase 3: Reel Playwright-E2E for selve redigerings-flowet af en privat aftale (feltskift bevarer `visibility: "private"`; at slå privatliv fra sender rent faktisk `visibility: "default"`) + `32_Workers_AI_Data_Policy.md` (kodeverificeret gennemgang af alle tre AI-brugssteder, felter sendt/aldrig sendt, fejlhåndtering logger ikke prompten) — ren test/dokumentation, ingen adfærdsændring, selv-merget efter grøn CI | PR #143 |
| 2026-08-28 | Fase 9: "Delte kalendere (ICS)" fik sin egen række + dedikeret dialog i "Kalenderforbindelser" (samme niveau som Google/Outlook, efter ønske fra Nicolaj), og hvert abonnements navn/medlemstildeling kan nu redigeres (ikke selve ICS-linket) — genbruger eksisterende PATCH-rute/klientfunktion, ingen ny backend. Godkendt visuelt af Nicolaj ud fra skærmbilleder. Synlig ny funktion — til gennemgang, ikke selv-merget | PR #144 |
| 2026-08-28 | Fase 5: Reel Playwright-E2E for kalenderaftale-CRUD gennem den rigtige UI (opret/redigér/slet), plus en arkitektonisk afklaring: "gentagen aftale/enkeltforekomst" kan ikke testes gennem noget UI i dag, da kun en "internal"-kilde (ikke længere i produktionskoden) understøtter det — fjernet fra "Mangler" i stedet for markeret som en manglende test. Ren test/dokumentation, ingen adfærdsændring, selv-merget efter grøn CI | PR #145 |
| 2026-08-28 | Fase 9: Valgfri farve pr. ICS-abonnement, efter ønske fra Nicolaj — ny nullable `color`-kolonne (migration 0019), genbruger familiemedlemmers faste 8-farve-swatch-vælger, vist kun når intet medlem er tildelt. Godkendt visuelt af Nicolaj ud fra skærmbilleder. Synlig ny funktion — til gennemgang, ikke selv-merget | PR #146 |
| 2026-08-28 | Fase 5: Fuldt invitations-/rolle-UI-flow. Ny bruger kan taste en invitationskode ind og komme ind i appen (reel E2E). Rolleadministration havde slet ingen UI før — ny `GET /:id/memberships`-rute + ny "Medlemmer og roller"-dialog (rolleskift kun ejer, fjernelse ejer/admin, aldrig på egen/ejerens række), genbruger allerede testede serverruter. 2 nye servertests + 2 nye reelle Playwright-E2E-tests. Synlig ny funktion — til gennemgang, ikke selv-merget | PR #147 |
| 2026-08-28 | Fase 1: Rettet farve-/ejerskabsfejl fra Nicolajs fejlrapport — en aftale med navngivne medlemmer i titlen viste generisk "Familien"-lilla i stedet for deres egne farver, da kun kalender-tildelingen (ikke aftalens egne Google-deltagere) bestemte farven. Ny `matchAttendeesToOwnerIds.ts` matcher deltager-e-mails mod medlemmers koblede konto-e-mail (ny `linkedUserEmail`-felt end-to-end); matcher intet, uændret gammel adfærd. Nye enhedstests + visuel før/efter-reproduktion. Synlig funktionsændring — til gennemgang, ikke selv-merget | PR #148 |
| 2026-08-28 | Fase 1: Opfølgning på PR #148 (allerede merget, ny PR) — `getEventOwnerColor()` gav stadig Familien-farven ved flere matchede ejere, og et ikke-tildelt ICS-abonnement fik intet ejerskab på selve aftalen. Én central regel (`getEventOwnerColors()` + `getEventOwnerBorderSx()`, opdelt venstrekant ved flere medlemmer) brugt identisk af måned/uge/dag/familie/liste-visningen. Nyt `CalendarEvent.color`-felt som ICS-kildens fald-tilbage. 15 nye/ændrede enhedstests + 2 nye Playwright-tests, der beviser den faktiske CSS-farve, ikke kun ownerIds. Synlig funktionsændring — til gennemgang, ikke selv-merget | PR #149 |
| 2026-08-28 | Fase 1: Visuel opfølgning fra Nicolaj efter test på iPhone (egen, parallel session) — aftalefarver fremstod udvaskede pga. for kraftig gennemsigtig baggrund, og kalenderfilteret viste kildens egen farve i stedet for det faktisk matchede medlems. Skiftet fra `border-image`-venstrekant til en fuldt mættet accentstribe via et pseudo-element (undgår halvmåneform på afrundede kort), baggrundstoning reduceret ca. 19% → 8%, og en ny `getCalendarSourceDisplayColors()` lader "Vis kalendere"-filteret bruge samme farveopløsning som selve aftalekortene. Godkendt og merget af Nicolaj | PR #150 |
| 2026-08-28 | Fase 5: Sidste "Mangler"-punkt lukket — reel Playwright-E2E for opret/redigér/slet gennem UI'et på indkøbsliste (vare + hel liste), opgaver og rutiner (kun opret/slet — ingen redigér-UI findes for en rutine, arkitektonisk fakta). 3 nye tests. Ren test/dokumentation, ingen adfærdsændring, selv-merget efter grøn CI | PR #152 |
| 2026-08-29 | Fase 5: Sidste to punkter lukket — logout/lokal oprydning og en generel online-API-fejl (E2E). Fandt undervejs en ægte funktionsfejl: `useSession()`'s manglende delte context lod logout kun opdatere Indstillinger-siden lokalt, mens resten af app-skallen forblev synligt logget ind uden en manuel genindlæsning. Rettet med `window.location.reload()` efter logout (samme mønster som backup-import). Synlig funktionsændring — godkendt af Nicolaj før implementering, til gennemgang, ikke selv-merget | PR #153 |
| 2026-08-29 | Fase 4: Kodeverificeret gennemgang af alle fem Google OAuth-scopes (ingen overflødige) og redirect-URI-håndtering (allerede domæneuagtig kode, intet at rette). Fandt og rettede to helt forældede README'er, som stadig beskrev det fjernede klient-popup-flow fra Sprint 11.1 (`VITE_GOOGLE_CLIENT_ID` i `.env.local`) i stedet for det faktiske server-side authorization-code+PKCE-flow — kunne have vildledt Google Cloud Console-opsætningen. Indsnævrer Fase 4's resterende punkter til rene eksterne handlinger i Google Cloud Console. Ren dokumentationsrettelse, ingen kodeændring, selv-merget efter grøn CI | PR #154 |
| 2026-08-29 | Fase 7: Nicolaj slog Cloudflares native Git-deploy fra i dashboardet — kun GitHub Actions-pipelinen deployer nu beta/produktion. Fasens sidste eksterne "ekstern handling"-blokering for selve deploy-pipelinen er dermed fjernet; kun D1-gendannelsesøvelsen og release til `main` mangler, begge afventer et aftalt tidspunkt med Nicolaj. Ren dokumentationsopdatering, ingen kodeændring, selv-merget efter grøn CI | PR #155 |
| 2026-08-29 | Fase 4: Tilføjede Google Search Console-domæneverificeringsfil (`public/google1e28839311687158.html`) som led i Nicolajs igangværende OAuth-verificering. Ren, usynlig statisk fil, ingen adfærdsændring, selv-merget efter grøn CI | PR #156 |
| 2026-08-29 | Fase 1 + Fase 2: Nicolaj gennemførte den fysiske iPhone-verifikation (Safari/PWA, mobilvisning uden overlap/dubletter) og VoiceOver-testen af de primære flows (navigation, indkøb, opgaver, kalenderaftale) — ingen problemer fundet. Fase 2 er dermed fuldt gennemført; Fase 1 mangler kun kildespecifik dubletanalyse, hvis en dublet observeres igen. Ren dokumentationsopdatering, ingen kodeændring, selv-merget efter grøn CI | PR #157 |
| 2026-08-29 | Fase 2: Fandt og rettede issue #20's sidste kriterie — måned- og dagsvisningen viste ejerskab af en aftale UDELUKKENDE via farven, uden noget synligt navn/ikon som backup (uge-/familievisningen havde allerede navnet som tekst). Nyt synligt initial-badge (`EventOwnerBadges.tsx`) på aftalekort og dags-prikker, plus ejernavn tilføjet til `getEventActionLabel()`s aria-label på alle fire visninger (var slet ikke der før). Godkendt visuelt af Nicolaj ud fra skærmbilleder. Synlig funktionsændring — til gennemgang, ikke selv-merget | PR #158 |
| 2026-08-29 | Fase 3: Lukket to sidste punkter efter Nicolajs godkendelse. Privatlivssikre standardværdier for nye familier/delinger kodeverificeret som allerede korrekte (ny aftale synlig for familien som udgangspunkt; nyt delelink inkluderer aldrig beskrivelse/lokation uden aktivt tilvalg) — ingen kodeændring nødvendig. Kalenderniveau-privatlivsvalg bevidst fravalgt som unødvendig udvidelse ud over den eksisterende aftaleniveau-kontakt. Ren dokumentationsopdatering, selv-merget efter grøn CI | PR #159 |
