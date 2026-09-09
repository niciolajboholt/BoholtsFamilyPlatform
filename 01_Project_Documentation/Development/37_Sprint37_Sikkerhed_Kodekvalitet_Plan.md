# 37_Sprint37_Sikkerhed_Kodekvalitet_Plan

> **Omdøbt fra "Sprint 34" til "Sprint 37"** ved merge med `develop`
> (2026-09-09): `develop` havde i mellemtiden fået sit eget "Sprint 34"
> (Google gentagne aftaler) og "Sprint 36" (manuelt ejerskab), uden
> nummer 35 nogetsteds. Dette sprints indhold er uændret — kun
> nummereringen er rettet for at undgå to forskellige sprints med samme
> nummer.

> Status: Godkendt og kode gennemført — afventer manuel gennemgang, CI og merge

Version: 2.0

Project:
Boholts Family Platform

Last Updated:
2026-09-09 (godkendt af Nicolaj og gennemført samme dag)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et eksternt review af repoet (main) leverede en udbygningsplan med seks
rettelsespunkter og en liste af nye funktionsforslag. Denne plan dækker
**kun rettelsespunkterne** (Del A i reviewet) — nye funktioner planlægges
separat, ét sprint ad gangen, når dette sprint er afsluttet.

Hvert punkt er verificeret direkte mod den faktiske kode og dokumentation
(ikke taget for pålydende) før planen blev skrevet, jf. arbejdsgangen i
[11_AI_Onboarding_Guide](../AI_Knowledge_Base/11_AI_Onboarding_Guide.md) og
[06_Claude_Playbook](../AI_Knowledge_Base/06_Claude_Playbook.md). To af
reviewets seks punkter viser sig allerede at være løst eller i alt
væsentligt gennemført — det er dokumenteret nedenfor i stedet for stille
udeladt.

---

## Verificeret status pr. punkt

### 1. `wrangler.jsonc` eksponerer ADMIN_EMAIL, database_id og store_id — BEKRÆFTET

`05_App/web/wrangler.jsonc` indeholder i dag, i klartekst, i begge miljøer:

- `ADMIN_EMAIL: "nicolajbach12@gmail.com"` — en rigtig, personlig e-mail.
- Rigtige D1 `database_id` for både det unavngivne produktionsmiljø og
  `env.beta`.
- Det rigtige Secrets Store `store_id` (delt af alle fire secrets i filen).

`ADMIN_EMAIL` bruges til at afgøre, hvem der må se indsendt feedback
(`GET /api/feedback`, Sprint 30) — det er ikke selv en hemmelighed
(kommenteret i filen), men det er en unødvendig personlig identifikator i
et offentligt repo, og filen har allerede en fungerende Secrets
Store-mekanisme for præcis denne slags værdi (fire andre secrets bruger
den).

`database_id` og `store_id` er derimod ikke hemmeligheder i sig selv (de
giver ikke adgang uden separat Cloudflare-autentifikation), og de er reelt
nødvendige i den tracked fil, for at GitHub Actions' `wrangler deploy` kan
binde ressourcerne — wrangler har ingen indbygget miljøvariabel-
interpolation for disse felter i `.jsonc`. De kan altså ikke bare fjernes
uden at knække CI-deploy.

### 2. "Beta er reelt produktion" — ALLEREDE BESLUTTET, MANGLER KUN FORMALISERING

Dette er **ikke en åben beslutning**. `wrangler.jsonc`s egne kommentarer
(linje 82-91 og 114-121) dokumenterer, at Nicolaj bekræftede i Sprint 28
(2026-08-19), at familiens rigtige data og PWA'en på hjemmeskærmen ligger
under `env.beta`, og at det unavngivne produktionsmiljø reelt ikke bruges
— derfor har det tomme `crons: []` (Cloudflare Free-planens konto-brede
5-cron-loft gør, at begge miljøer ikke kan have 3 hver). Sprint 29's plan
bekræfter samme beslutning eksplicit som "bevidst udeladt" derfra.

Der blev også forsøgt en omdøbning (2026-08-23), rullet tilbage fordi
Cloudflare Workers Builds er bundet til den eksisterende Worker-ressource
og ikke følger et navneskifte i filen — en reel omlægning kræver en helt
ny Worker-ressource, vurderet som mere arbejde end værd.

**Det, der mangler, er udelukkende en ADR** (`ADR-018`), der formaliserer
denne allerede trufne beslutning på linje med projektets øvrige
arkitekturbeslutninger — ikke ny kode, ikke en ny beslutning.

### 3. Ingen eksplicit CSRF-beskyttelse — BEKRÆFTET, VURDERING MANGLER

Bekræftet ved kodegennemgang: session-cookien sættes med `sameSite: "Lax"`
(`server/lib/session.ts` og `server/routes/auth.ts`), og der findes intet
CSRF-token nogetsteds i kodebasen. `13_Release_And_Security_Baseline.md`
lister kun "Secure/HttpOnly/SameSite-sessioncookies" som kontrol.

Der er endnu ikke taget stilling til, om dette er tilstrækkeligt — det
kræver en gennemgang af, om samtlige tilstandsændrende ruter reelt kun
accepterer non-GET-metoder (SameSite=Lax beskytter ikke mod en
tilstandsændring udløst via en simpel GET-navigation). Denne verifikation
indgår som en del af selve ADR-arbejdet nedenfor, ikke som en antagelse.

### 4. `ShoppingListPage.tsx` og `CalendarPage.tsx` er store filer — BEKRÆFTET

Talt direkte: `ShoppingListPage.tsx` er 516 linjer, `CalendarPage.tsx` er
475 linjer. Begge overlevede Fase 6-refaktoreringen
(`30_Stabilization_Execution_Plan.md`), som splittede syv andre filer
efter samme mønster (afledt tilstand/hooks ud i egne filer, UI splittet i
underkomponenter, ingen adfærdsændring, verificeret med fuld
Playwright-suite).

### 5. Dependency-versioner i `package.json` — VERIFICERET REELLE, IKKE FEJLSKREVNE

Slået direkte op mod npm-registeret (ikke kun trænet hukommelse, som kan
være forældet for dette tidspunkt):

- `typescript: ~6.0.2` — 6.0.2 er en reelt udgivet version. Der findes dog
  nyere (`6.0.3`, og en nyere major `7.0.2`) — ikke en fejl, men en reel
  `npm outdated`-kandidat.
- `vite: ^8.1.1` — reel, aktuel major (registeret går til `8.3.0-beta.x`).
- `eslint: ^10.9.0` — reel, aktuel major (registeret går til `10.10.0`).

Konklusion: ingen af de tre er fejlskrevne. Opgaven er en almindelig
`npm outdated`-gennemgang, ikke en rettelse af forkerte tal.

### 6. Component-/hook-tests i Strict Mode + resterende Playwright-flows — I ALT VÆSENTLIGT ALLEREDE GENNEMFØRT

Reviewets antagelse holder ikke længere ved gennemgang af faktisk kode og
`30_Stabilization_Execution_Plan.md`s statusoverblik:

- `src/main.tsx` monterer allerede appen i `<StrictMode>`.
- Fase 2 (tilgængelighed/visuelt polish) og Fase 5
  (browserbaserede brugerflowtests) er begge markeret **"Gennemført"** i
  stabiliseringsplanens ledelsesoverblik.
- `e2e/app-smoke.spec.ts` indeholder i dag 27 reelle Playwright-tests:
  login/jura, fuld navigation, WCAG 2.0/2.1 A/AA-audit, tastatur-/
  fokusgennemgang, mobilbredde-matrix, alle tre offline-skrivekø-flows,
  privat-aftale-redaktion (ejer/medlem/delelink), CRUD på kalenderaftaler,
  indkøbslister, opgaver og rutiner, invitations-/rolleflow, og logout-
  oprydning.

Reviewets punkt 6 er derfor **stale** i forhold til den nuværende kode —
ikke en overset opgave, men et fund, der allerede er indhentet af arbejde
gjort efter reviewets datagrundlag. Det eneste reelt åbne spørgsmål er, om
funktioner tilføjet SIDEN Fase 5 blev lukket (fx Sprint 33's "Siden sidst
du var her") har deres egen Playwright-dækning — det har de allerede
(`Sprint33`-planen nævner ikke selv e2e-arbejde, så dette bør tjekkes som
en kort revision, ikke som en ny testindsats fra bunden).

---

## Slået fra (allerede løst, ikke en del af dette sprint)

To af reviewets øvrige punkter (Del A3.7-A3.8) kræver ingen kode:

- **Rate-limiteren** (`SELECT` + `INSERT` pr. kald) — reviewet selv
  vurderer det som "fint til familie-skala". Ingen handling; overvåges
  hvis et delelink nogensinde deles bredt.
- **Cloudflare dobbelt-deploy** — ALLEREDE LØST. Nicolaj slog Cloudflares
  native Git-deploy fra 2026-08-29 (PR #155); kun GitHub Actions deployer
  nu.
- **Fysisk iPhone/Safari/VoiceOver-test** — ALLEREDE GENNEMFØRT
  (2026-08-29, PR #157), ingen problemer fundet.
- **Google OAuth-verificering** — fortsat udestående, men er en ekstern
  handling i Google Cloud Console, som kun Nicolaj kan udføre. Ikke en
  kodeopgave.

---

## Foreslået scope og rækkefølge

1. **ADMIN_EMAIL → Secrets Store.** Flyt værdien fra `vars` til
   `secrets_store_secrets` (samme mønster som de fire eksisterende
   secrets) i begge miljøer. Tilføj `wrangler.example.jsonc` med
   placeholder-værdier for `database_id`/`store_id`/`GOOGLE_CLIENT_ID` til
   brug for en ny bidragyder eller et evt. fork — den rigtige
   `wrangler.jsonc` beholder de reelle ressource-ID'er, da CI-deployet
   kræver dem, og de ikke er reelle hemmeligheder.
2. **ADR-018: Miljønavngivning (produktion vs. beta).** Formaliserer den
   allerede trufne beslutning fra Sprint 28 — ingen kodeændring, ren
   dokumentation.
3. **ADR-019: CSRF-stillingtagen.** Inkluderer en kort verifikation af, at
   ingen tilstandsændrende rute accepterer GET, før konklusionen
   "SameSite=Lax er tilstrækkeligt" skrives ned. Hvis verifikationen
   finder en rute, der bryder denne antagelse, rettes ruten som en del af
   samme punkt, og ADR'en konkluderer i stedet at et CSRF-token er
   nødvendigt.
4. **`npm outdated`-gennemgang.** Sammenlign hele `package.json` mod
   registeret (ikke kun de tre nævnte pakker), og opdatér hvor det er en
   ren patch/minor uden kendte breaking changes. En evt. TypeScript
   major-opgradering (6→7) vurderes for sig og udskydes, hvis den kræver
   ikke-trivielle kodeændringer.
5. **Opdel `ShoppingListPage.tsx` og `CalendarPage.tsx`.** Samme mønster
   som Fase 6: afledt tilstand/hooks ud i egne filer, UI i
   underkomponenter efter ansvar, ingen adfærdsændring — verificeret med
   fuld Playwright-suite efter hver fil.
6. **Kort revision af Playwright-dækning for funktioner tilføjet siden
   Fase 5** (primært Sprint 33's "Siden sidst du var her"). Kun nye tests,
   hvis revisionen faktisk finder et hul — ikke en ny testindsats fra
   bunden.

Rækkefølgen går fra lavest til højest risiko for regressioner: ren
konfiguration/dokumentation først (1-3), så housekeeping (4), så de to
refaktoreringer med størst diff og størst behov for regressionstest til
sidst (5-6).

---

## Kvalitetsgate

Som beskrevet i
[13_Release_And_Security_Baseline](../AI_Knowledge_Base/13_Release_And_Security_Baseline.md):
`npm run lint`, `npm run build`, `npm test`, `npm run test:e2e` skal være
grønne før noget merges. Eventuelle nye D1-relaterede ændringer (ingen er
planlagt i dette sprint) skal verificeres manuelt med
`SELECT ... FROM sqlite_master`, ikke kun antages virkende.

---

## Godkendelse

Denne plan afventer Nicolajs godkendelse af scope og rækkefølge, før
noget af punkt 1-6 implementeres — jf. arbejdsgangen i
[06_Claude_Playbook](../AI_Knowledge_Base/06_Claude_Playbook.md) og den
eksplicitte instruks i reviewets Del C-prompt.

Godkendt 2026-09-09 ("Kør").

---

## Gennemførelse (2026-09-09)

Alle seks punkter er implementeret, i den foreslåede rækkefølge, hver som
sin egen commit på `claude/boholts-platform-expansion-e29ujp`:

1. **ADMIN_EMAIL → Secrets Store.** Gjort som planlagt. Bekræftet med
   `wrangler deploy --dry-run --env beta`. **Kræver at Nicolaj opretter
   secret'en `admin-email` i Cloudflares Secrets Store (samme store_id som
   de fire eksisterende) før næste rigtige deploy** — uden den fejler
   bindingen.
2. **ADR-018** skrevet som planlagt — ren dokumentation, ingen kodeændring.
3. **ADR-019** skrevet efter en reel, systematisk gennemgang af samtlige
   GET-ruter (ikke kun antaget) — fandt to lav-konsekvens undtagelser
   (aktivitetscursor, OAuth-callback), begge dokumenteret og vurderet
   uden skadepotentiale. Ingen kodeændring var nødvendig.
4. **`npm outdated`.** 14 pakker opdateret. `typescript` (6→7) og `vitest`
   (4→5) bevidst udskudt (major-opgraderinger). `@vitejs/plugin-react`
   patch-bump blokeret af en upstream peer-dependency-konflikt
   (`@babel/core@8` vs. `@rolldown/plugin-babel`) — ikke noget dette repo
   kan løse. `npm audit fix` kørt for en ikke-brydende `fast-uri`-sårbarhed;
   en resterende `sharp`/`miniflare`-sårbarhed (transitiv
   wrangler-devDependency) er bevidst IKKE rettet, da eneste fix ville
   nedgradere wrangler til 4.15.2.
5. **Sideopdeling.** `ShoppingListPage.tsx` 516→187 linjer,
   `CalendarPage.tsx` 475→98 linjer, samme mønster som Fase 6. Ingen
   adfærdsændring.
6. **Playwright-revision.** Fandt ét reelt hul (Sprint 33's aktivitetskort)
   og lukkede det med én ny, reel E2E-test.

### Vigtige fund og begrænsninger under gennemførelsen

- **Playwright kunne ikke køres direkte i denne session.** Den
  forudinstallerede Chromium-revision i sandboxen matcher ikke, hvad
  `@playwright/test` forventer — bekræftet at gælde uafhængigt af denne
  sprints afhængighedsopdatering. Punkt 5 og 6 er i stedet verificeret med
  en midlertidig, ALDRIG committet Playwright-config, der pegede på den
  forudinstallerede browser direkte. Den rigtige, autoritative
  e2e-verifikation sker i GitHub Actions (som installerer sin egen
  browser) — betragt ikke dette sprint som "e2e-grønt bekræftet" før CI
  har kørt.
- **To eksisterende, IKKE-relaterede e2e-tests fejler lige nu**
  ("a private calendar event is fully visible...",
  "editing an existing private event...") — de forudsætter en hardcodet
  kalenderaftale dateret 2026-08-27, som kalenderens standard-månedsvisning
  ikke længere viser, nu hvor den rigtige dato er passeret august 2026.
  Bekræftet identisk fejl på commit `121cf37` (FØR denne sprints
  refaktorering) — altså en allerede eksisterende skrøbelighed, ikke en
  regression herfra. **Ikke rettet i dette sprint** (uden for scope), men
  vil blokere en grøn `npm run test:e2e`, uanset denne gren. Bør rettes
  som sit eget, lille punkt (gør testdataene tidsrelative, ikke
  hardcodede) snarest.
- Punkt 4's og 5's afhængigheds-/dependency-relaterede fund
  (major-opgraderinger, peer-konflikten, sharp-sårbarheden) er bevidste
  udskydelser, ikke overset arbejde — se punkt 4 ovenfor.

**Status:** Klar til Nicolajs manuelle gennemgang og test, samt CI. Ikke
committet/mergeret til `develop`/`main` af denne agent — afventer
eksplicit godkendelse pr. sædvanlig arbejdsgang.
