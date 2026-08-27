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
| 1 | Kalenderens UI og dubletter | Delvist gennemført | Deduplikering samt bedre måned/uge-visning |
| 2 | Tilgængelighed og visuelt polish | Delvist gennemført | App-dækkende audit og fysisk VoiceOver-test |
| 3 | Privatliv og AI | Delvist gennemført | Privat aftale / “vis kun optaget” |
| 4 | Login, branding og OAuth | Delvist gennemført | Google-verificering og scope-gennemgang |
| 5 | Browserbaserede brugerflowtests | Delvist gennemført | CRUD-, rettigheds- og offline-scenarier |
| 6 | Refaktorering | Ikke startet | Opdeling af de største UI- og route-filer |
| 7 | Release, drift og dokumentation | Delvist gennemført | Fjern dobbelt deploy og beskyt branches |
| 8 | Offlineoplevelse | Delvist gennemført | Offline-skrivning, kø og konfliktløsning |

Appen er egnet til kontrolleret familiebrug og beta. Den er ikke vurderet som
offentligt lanceringsklar, før privatliv pr. aftale, OAuth-verificering,
kritiske E2E-flows og de resterende driftsværn er færdige.

## Verificeret baseline

Status pr. 2026-08-27:

- Stabiliseringspakken er merged til `develop` i
  [PR #102](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/102).
- Mobil familieagenda er merged til `develop` i
  [PR #103](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/103).
- Seneste kendte `develop`-commit er `d6966365b4f6923c0b544012891c3f34ca1ba94c`.
- Seneste beta-release er grøn i
  [GitHub Actions #301](https://github.com/niciolajboholt/BoholtsFamilyPlatform/actions/runs/33047118982).
- Betaens `/api/health` rapporterer database og migrationsstatus som grøn.
- Aktiv Cloudflare-version er `0734388f-31a3-4ce4-aa6c-7fae5c9a1546`.
- D1-migrationsregisteret er baselinet for migration 0002-0016, og migration
  0017 er anvendt på beta.
- Lokal kvalitetsbaseline: lint, produktionsbuild og 397 Vitest-tests består.
- Playwright indeholder login/jura, autentificeret navigation og mobil
  familieplanner-regression på desktop- og mobilprojekter.
- Produktionsafhængigheder havde 0 kendte npm-sårbarheder ved sidste audit.

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

### Mangler

- [ ] Spor synlige dubletter til kilden: flere kalenderkilder,
  gentagelsesudfoldning eller medlemsmapping.
- [ ] Indfør kun deduplikering med stabil identitet bestående af konto,
  kalender-id, event-id og eventuelt forekomst-id. Titel/tidspunkt må ikke være
  eneste nøgle.
- [ ] Forbedr månedsvisningen med læsbare titler og en kompakt måde at se alle
  aftaledetaljer på.
- [ ] Gør ugevisningen mere agendaorienteret, så tomme dage ikke stjæler
  størstedelen af pladsen.
- [ ] Tilføj regressionstests for deduplikering, gentagelser og reelle ens
  aftaler, som ikke må fjernes.
- [ ] Genverificér den seneste mobilvisning manuelt på iPhone Safari/PWA.

### Acceptkriterier

- Ingen overlappende overskrifter eller vandret side-overflow ved 320-430 px.
- Ingen utilsigtede dubletter.
- Gentagne aftaler og to reelt forskellige aftaler med samme titel/tidspunkt
  bevares.
- Måned, uge, dag og familievisning fungerer på desktop og mobil.

**Næste handling:** Kortlæg event-identiteten gennem API, normalisering og
gentagelsesudfoldning. Forbedr derefter måned og uge i en afgrænset UI-PR.

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

### Mangler

- [ ] Gennemfør tastatur- og fokusgennemgang af alle primære sider og dialoger.
- [ ] Gennemfør systematisk WCAG-kontrastkontrol af tekst, ikoner, personfarver
  og tilstande.
- [ ] Test alle hovedsider ved 320, 375, 390 og 430 px.
- [ ] Test fysisk med iPhone Safari, installeret PWA og VoiceOver.
- [ ] Ret eventuelle resterende felter uden label, fejlbesked eller tydelig
  fokusmarkering.

### Acceptkriterier

- Ingen formularfelter uden et forståeligt navn.
- Ingen vandret overflow i primære flows.
- Alle primære handlinger kan nås og aktiveres med tastatur.
- Kritiske farvekombinationer opfylder relevante WCAG-kontrastkrav.

**Næste handling:** Kør en side-for-side audit efter fase 1's kalenderændringer,
så samme UI ikke testes to gange.

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

### Mangler

- [ ] Tilføj privatliv pr. aftale eller kalender: “Privat” / “Vis kun optaget”.
- [ ] Redigér private data server-side, før de når dashboard, familievisning,
  delelink, pushnotifikation eller AI-input.
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

**Næste handling:** Udarbejd datamodel og redaktionsfunktion som ét centralt
server-side privatlivslag før UI-kontrollen tilføjes.

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

**Status: Ikke startet**

### Planlagt

- [ ] Opdel `ShoppingListPage.tsx`.
- [ ] Opdel `CalendarPage.tsx` og den voksende familieplanner.
- [ ] Opdel `SettingsPage.tsx`.
- [ ] Opdel `EditEventDialog.tsx`.
- [ ] Opdel `families.ts`.
- [ ] Opdel `shoppingLists.ts`.
- [ ] Opdel `tasks.ts`.
- [ ] Flyt validering og genbrugelig forretningslogik til services/hooks med
  målrettede tests.

### Acceptkriterier

- Sider koordinerer primært mindre komponenter og hooks.
- Serverruter er opdelt efter ansvar.
- Refaktorering og ny funktionalitet blandes ikke i samme PR.
- Eksisterende adfærd og tests bevares; flyttet logik får direkte tests.

**Næste handling:** Mål aktuelle filstørrelser og kobling efter fase 1-5, og
opdel én fil pr. PR begyndende med kalenderområdet.

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

### Mangler

- [ ] Deaktivér Cloudflares gamle native Git-deploy, så kun den
  kvalitetssikrede GitHub Actions-pipeline deployer beta.
- [ ] Beskyt `main` og `develop` med PR-krav og grøn CI; blokér direkte push til
  `main`.
- [ ] Gennemgå `PROJECT_STATUS.md`, roadmap, kravsporbarhed og Sprint 29 for
  resterende modstridende status.
- [ ] Dokumentér fuld D1 backup/restore-runbook og test en rollbackøvelse.
- [ ] Definér og udfør kontrolleret release fra `develop` til `main`, når de
  lanceringskritiske faser er opfyldt.

### Acceptkriterier

- Præcis commit, miljø, Worker-version og migrationsstatus kan spores.
- Ingen kode deployes til beta før grøn kvalitetskontrol.
- Releasechecklisten dækker deploy, migration, health, smoke-test og rollback.
- `main` kan ikke ændres direkte uden den aftalte kontrol.

**Ekstern handling:** Cloudflare Git-integration skal slås fra i dashboardet,
og branch protection kan kræve repository-ejerens godkendelse.

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

### Mangler

- [ ] Definér præcist hvilke kalender-, indkøbs- og opgavedata der må gemmes
  lokalt og hvor længe.
- [ ] Gem senest hentede tilladte kalenderdata sikkert til read-only offline.
- [ ] Tilføj kø til udvalgte indkøbs- og opgaveændringer.
- [ ] Definér konflikt- og genforbindelsesadfærd, herunder brugerens valg ved
  samtidige ændringer.
- [ ] Tilføj automatiske offline- og reconnect-tests.

### Acceptkriterier

- Brugeren kan tydeligt se netværkstilstanden og om en handling er gemt lokalt
  eller på serveren.
- Ingen OAuth-data, sessionscookies eller følsomme API-svar caches.
- Køede ændringer synkroniseres deterministisk eller giver en forståelig
  konfliktbesked.

**Næste handling:** Skriv en kort offline-datapolitik før IndexedDB/kø
implementeres.

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
| Branch protection | Kan kræve repository-ejer/plan | Alt arbejde leveres fortsat gennem PR og grøn CI |
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
| 2026-08-27 | Denne autoritative udførelses- og statusplan oprettet | Dokumentations-PR |
