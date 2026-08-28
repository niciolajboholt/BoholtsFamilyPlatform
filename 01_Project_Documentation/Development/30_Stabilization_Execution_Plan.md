# Stabiliserings- og lanceringsplan

| Felt | Værdi |
|---|---|
| Status | Aktiv |
| Version | 1.0 |
| Senest opdateret | 2026-08-27 |
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
| 1 | Kalenderens UI og dubletter | Delvist gennemført | Manuel iPhone-verifikation og eventuel kildespecifik dubletanalyse |
| 2 | Tilgængelighed og visuelt polish | Delvist gennemført | App-dækkende audit og fysisk VoiceOver-test |
| 3 | Privatliv og AI | Delvist gennemført | E2E for ejer/andet medlem + offentligt delelink |
| 4 | Login, branding og OAuth | Delvist gennemført | Google-verificering og scope-gennemgang |
| 5 | Browserbaserede brugerflowtests | Delvist gennemført | CRUD-, rettigheds- og offline-scenarier |
| 6 | Refaktorering | Gennemført | — |
| 7 | Release, drift og dokumentation | Delvist gennemført | Fjern dobbelt Cloudflare-deploy (ekstern) |
| 8 | Offlineoplevelse | Delvist gennemført | Playwright-offline-test for kalendervisnings-fallbacket |

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
- Lokal kvalitetsbaseline: lint, produktionsbuild og 463 Vitest-tests består.
- Playwright indeholder login/jura, autentificeret navigation, kalenderlayout,
  kontrolnavne og mobilbredde-matrix på desktop- og mobilprojekter.
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

### Mangler

- [ ] Spor synlige dubletter til kilden: flere kalenderkilder,
  gentagelsesudfoldning eller medlemsmapping.
- [ ] Genverificér den seneste mobilvisning manuelt på iPhone Safari/PWA.

### Acceptkriterier

- Ingen overlappende overskrifter eller vandret side-overflow ved 320-430 px.
- Ingen utilsigtede dubletter.
- Gentagne aftaler og to reelt forskellige aftaler med samme titel/tidspunkt
  bevares.
- Måned, uge, dag og familievisning fungerer på desktop og mobil.

**Næste handling:** Deploy den afgrænsede kalender-PR og genverificér måned,
uge og familieagenda på iPhone. Hvis en dublet stadig ses, logges de stabile
identitetsfelter lokalt i en sikker debugvisning for at afgøre, om Google
returnerer samme aftale gennem to reelt forskellige kalendere.

## Fase 2 – Tilgængelighed og visuelt polish

**Mål:** Alle primære flows skal kunne forstås og betjenes med tastatur,
skærmlæser og smalle mobilskærme uden at ændre appens varme grønne design.

**Status: Delvist gennemført**

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

### Mangler

- [ ] Gennemfør tastatur- og fokusgennemgang af alle primære sider og dialoger.
- [ ] Gennemfør systematisk WCAG-kontrastkontrol af tekst, ikoner, personfarver
  og tilstande.
- [ ] Test fysisk med iPhone Safari, installeret PWA og VoiceOver.
- [ ] Ret eventuelle resterende felter uden label, fejlbesked eller tydelig
  fokusmarkering.

### Acceptkriterier

- Ingen formularfelter uden et forståeligt navn.
- Ingen vandret overflow i primære flows.
- Alle primære handlinger kan nås og aktiveres med tastatur.
- Kritiske farvekombinationer opfylder relevante WCAG-kontrastkrav.

**Næste handling:** Udvid den automatiske audit med tastatur-rækkefølge og
kontrastkontrol. Afslut derefter fasen med fysisk iPhone/PWA/VoiceOver-test.

## Fase 3 – Privatliv og AI

**Mål:** Et familiemedlem skal kunne dele sin tilgængelighed uden at dele
følsomme titler, beskrivelser eller lokationer, og AI-behandling skal være et
bevidst valg.

**Status: Delvist gennemført**

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

### Mangler

- [ ] Overvej et separat privatlivsvalg på kalenderniveau; aftaleniveau er nu
  implementeret som “Privat / vis kun optaget”.
- [ ] Definér privatlivssikre standardværdier for nye familier og nye
  delinger.
- [ ] Tilføj frontend- og servertests for redigering, adgangskontrol og
  flerfamilie-isolation.
- [ ] Dokumentér præcist hvilke felter Workers AI modtager, og hvor længe de
  behandles.

### Acceptkriterier

- En privat aftales titel, beskrivelse og lokation forlader aldrig den tilladte
  kontekst.
- AI-resumé kan fravælges og modtager aldrig private felter.
- Offentlige links viser mindst mulige data som standard.

**Næste handling:** Udbyg E2E med ejer/andet familiemedlem samt offentligt
delelink, og dokumentér præcist Workers AI-feltgrundlag og datalevetid.

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

### Mangler

- [ ] Gennemgå og dokumentér hvert Google OAuth-scope og fjern eventuelle
  overflødige scopes.
- [ ] Kontrollér redirect-URI'er for beta og senere produktionsdomæne.
- [ ] Færdiggør Google OAuth-verificering og consent-screen-branding.
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

**Status: Delvist gennemført**

### Gennemført

- [x] Playwright er installeret og adskilt fra Vitest.
- [x] CI installerer Chromium og kører E2E-pakken.
- [x] Ikke-logget bruger ser login og kan åbne juridiske sider.
- [x] Mock-autentificeret bruger kan navigere gennem de fem hovedområder på
  desktop og mobil.
- [x] Mobil familieplanner testes for vandret overflow.

### Mangler

- [ ] Opret, redigér og slet kalenderaftale med mock/testkonto.
- [ ] Gentagen aftale samt redigering af enkeltforekomst.
- [ ] Invitation, roller og isolation mellem to familier.
- [ ] Indkøbsliste, opgaver og rutiner.
- [ ] Offentligt kalenderlink og privatlivsvalg.
- [ ] Logout og fuldstændig lokal oprydning.
- [ ] API-fejl, offline-tilstand og genforbindelse.

### Acceptkriterier

- Kritiske flows kan køres deterministisk i CI uden rigtige secrets eller
  produktionsdata.
- Fejl giver læsbare traces/screenshots, og flaky tests blokerer ikke uden en
  dokumenteret årsag.

**Næste handling:** Udbyg den eksisterende mock-backend med event-CRUD og
rettighedsscenarier efter fase 1 og 3.

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

### Mangler

- [ ] Deaktivér Cloudflares gamle native Git-deploy, så kun den
  kvalitetssikrede GitHub Actions-pipeline deployer beta.
- [ ] Udfør selve D1-gendannelsesøvelsen (kør `time-travel restore` og
  bekræft resultatet) — kræver et aftalt tidspunkt med Nicolaj, se ovenfor.
- [ ] Definér og udfør kontrolleret release fra `develop` til `main`, når de
  lanceringskritiske faser er opfyldt.

### Acceptkriterier

- Præcis commit, miljø, Worker-version og migrationsstatus kan spores.
- Ingen kode deployes til beta før grøn kvalitetskontrol.
- Releasechecklisten dækker deploy, migration, health, smoke-test og rollback.
- `main` kan ikke ændres direkte uden den aftalte kontrol.

**Ekstern handling:** Cloudflare Git-integration skal slås fra i dashboardet
(kræver dashboard-adgang).

## Fase 8 – Offlineoplevelse

**Mål:** Appen skal kommunikere ærligt om offline-tilstand og senere kunne
håndtere udvalgte læse- og skriveflows uden at cache følsomme credentials.

**Status: Delvist gennemført**

### Gennemført

- [x] Appen viser offline- og genforbindelsesstatus.
- [x] Teksten lover ikke offline-skrivning, som endnu ikke er implementeret.
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
  slettet i mellemtiden). Selve IndexedDB/kø-implementeringen er ikke
  påbegyndt endnu — det er den efterfølgende opgave, nu med en skrevet
  ramme at bygge inden for.
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
  offline-tests.

### Mangler

- [ ] En dedikeret Playwright-offline-test for kalendervisnings-fallbacket
  (PR #125) — den blev kun verificeret med provider-/lagringsenhedstests,
  ikke en fuld browsertest af selve offline/reconnect-forløbet, i
  modsætning til de tre skrivekø-flows, som nu hver har sin egen.
- [ ] Eventuel fremtidig udvidelse af skrivekøen ud over politikkens
  nuværende liste (fx redigering/sletning af varer/opgaver) — kræver en ny
  politikbeslutning først, ikke kun kode.

### Acceptkriterier

- Brugeren kan tydeligt se netværkstilstanden og om en handling er gemt lokalt
  eller på serveren.
- Ingen OAuth-data, sessionscookies eller følsomme API-svar caches.
- Køede ændringer synkroniseres deterministisk eller giver en forståelig
  konfliktbesked.

**Næste handling:** Tilføj en Playwright-offline-test for
kalendervisnings-fallbacket (PR #125), så alle fire Fase 8-flows har samme
niveau af browserverificeret dækning. Dette er en test-only opgave uden
selvstændig UX-beslutning, så den kan selv-merges, hvis den ikke ændrer
nogen synlig adfærd.

## Prioriteret udførelsesrækkefølge

Arbejdet fortsætter autonomt i denne rækkefølge, med grøn CI efter hver
afgrænset PR:

1. Færdiggør fase 1: event-identitet/dubletter og kalenderens måned/uge-UX.
2. Færdiggør fase 2's automatiserbare tilgængeligheds- og mobilkontroller.
3. Implementér fase 3's privat-aftale/redaktionslag.
4. Udbyg fase 5 med kritiske CRUD-, rettigheds- og privatlivsflows.
5. Opdel de største filer i rene refaktor-PR'er (fase 6).
6. Færdiggør drift/runbooks og eliminér dobbelt deploy (fase 7).
7. Implementér den aftalte offline-datapolitik og tests (fase 8).
8. Afslut Google OAuth-verificering og fysisk enhedstest, og frigiv derefter
   kontrolleret fra `develop` til `main`.

Eksterne handlinger eller reelle produktvalg må ikke blokere uafhængigt
arbejde; de samles i afsnittet nedenfor og tages til sidst.

## Åbne eksterne handlinger og beslutninger

| Punkt | Hvorfor det ikke løses alene i kode | Midlertidig håndtering |
|---|---|---|
| Slå Cloudflare native Git-deploy fra | Kræver dashboard-adgang | GitHub Actions er den dokumenterede kvalitetspipeline |
| Google OAuth-verificering | Kræver Google Cloud-ejergodkendelse | Login/jura og branding er kodeklargjort |
| Eget produktionsdomæne | Domæne- og produktbeslutning | Beta fortsætter på `workers.dev` |
| Fysisk iPhone/VoiceOver | Kræver rigtig enhed og brugerhandling | Automatiske mobiltests køres i CI |

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
