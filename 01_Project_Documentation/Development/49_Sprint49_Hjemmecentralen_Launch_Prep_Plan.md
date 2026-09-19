# 49_Sprint49_Hjemmecentralen_Launch_Prep_Plan

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Plan skrevet efter kodeverifikation (EXPLORE) — afventer implementering (dette dokument dækker CODE-fasen, udført i samme arbejdsomgang).

---

## Formål

Gøre platformen teknisk og indholdsmæssigt klar til en senere offentlig
lancering under det brugerrettede navn **Hjemmecentralen**, uden at ændre
funktionalitet, data, integrationer eller deploymentopsætning. Arbejdet er
afgrænset til fem områder: juridiske tekster, sikkerhedsheaders på den
statiske appskal, brugerrettet branding, dokumentationsopdatering, og en
efterfølgende (ikke-implementeret) plan for "Barnets Hjemmecentral".

Ingen ændringer i denne omgang til: Cloudflare-ressourcenavne, OAuth-
redirects, D1-skema, secrets, eller destruktive sletning af brugerdata.

---

## A. Verificerede fund

### A1. Privatlivspolitik (`src/pages/LegalPage.tsx`) er forældet og ufuldstændig

Dateret 26. august 2026. Beskriver kun Google-login/-kalender og AI. Verificeret
mod den faktiske kode, mangler eller beskriver forkert:

- **Microsoft-login** (`server/routes/auth.ts`, migration 0030) — reel, aktiv
  login-metode, ikke nævnt.
- **Microsoft/Outlook-KALENDER** — `outlookCalendarConfig.ts` har
  `isTemporarilyDisabled = true`: integrationen er kodet, men slået fra i
  produktion (Azure-tenant-blokering). Skal beskrives præcist som
  midlertidigt sat på pause, ikke som aktiv datahentning.
- **iCloud CalDAV** (`server/lib/icloudCalDav.ts`, migration 0029) —
  app-specifik adgangskode, kryptering, ikke nævnt.
- **ICS-abonnementer** (migration 0018/0019, `icsCalendar.ts`) — ikke nævnt.
- **Fødselsdage/gaveplaner** (migration 0025) — ikke nævnt.
- **Opgavebelønning/lommepenge** (migration 0024, `allowance.ts`) — ikke nævnt.
- **Fællesøkonomi** (migration 0026, `sharedExpenses.ts`) — ikke nævnt.
- **Måltidsplaner** (migration 0023, `mealPlan.ts`) — ikke nævnt.
- **Push-abonnementer** — nævnt implicit ("notifikationer"), ikke som
  gemt datapunkt (endpoint/nøgler, migration 0005).
- **Lokale offline-caches/synkroniseringskøer** — nævnt kun som "en
  begrænset cache", unødigt vagt.
- **Delte kalenderlinks** (migration 0010, 0013) — nævnt, men uden at det
  fremgår at linket selv ikke kræver login for modtageren.
- **Dataansvarlig/kontakt** — kun en e-mailadresse, ingen navngivet
  dataansvarlig.
- **Eksportbeskrivelse** — se A2.

Verdikt: politikken skal genskrives fra bunden med samme struktur, udvidet
til at dække alle nuværende databehandlinger.

### A2. Dataeksport dækker kun lokale data — server-/familiedata er IKKE inkluderet

`src/features/settings/components/AccountDataSection.tsx` +
`src/features/calendar/preferences/dataBackupStorage.ts`:

- `createDataBackup()` samler **kun** `localStorage`-nøgler med præfikset
  `boholts-family-` (lokale UI-præferencer, kalender-cache, kalender-
  medlem-mappings). Ingen server-kald.
- Dialogteksten i UI'et ("Backupfilen indeholder lokale indstillinger og
  kalenderdata, som ligger på denne enhed. Familie, opgaver og
  indkøbslister gemmes sikkert i appens database.") er **allerede korrekt
  og ærlig** — det er privatlivspolitikkens påstand om "eksportere ...
  appdata fra Indstillinger", der er misvisende, fordi den ikke skelner
  mellem lokal backup og serverdata.
- **Ingen kontosletning findes.** Der er ingen route eller UI-handling,
  der sletter en bruger, en familie, eller al en brugers data på tværs af
  familier. Individuelle rækker (opgaver, indkøbsvarer, medlemmer,
  forbindelser) kan slettes ét ad gangen af en ejer/admin — det er
  redigering, ikke kontosletning.
- **Ingen familiesletning findes** (kun individuel medlemsfjernelse:
  `familyMembers.delete("/:id/members/:memberId")`).
- **Ekstern kalenderdata afkobles, slettes ikke.** At fjerne en Google-,
  Microsoft- eller iCloud-forbindelse sletter kun appens egen kobling
  (token, mapping) — selve kalenderdata hos udbyderen røres ikke, hvilket
  er forventet og korrekt adfærd, men bør stå eksplicit i politikken.

Verdikt: eksport-UI'ets tekst er sandfærdig og skal IKKE ændres i
funktionalitet. Privatlivspolitikken skal rettes til at beskrive præcis
denne afgrænsning og henvise til manuel sletningsanmodning via e-mail,
indtil en egentlig kontosletnings-/eksportfunktion er bygget (se afsnit E).

### A3. Sikkerhedsheaders anvendes kun på `/api/*` og `/auth/*` — ikke på den statiske appskal

`server/index.ts` sætter `X-Content-Type-Options`, `Referrer-Policy` og
`Content-Security-Policy` i en Hono-middleware på `app.use("*", ...)`.
Middlewaren kører kun, når en request faktisk rammer Worker-scriptet.

`wrangler.jsonc` (både unavngivet miljø og `env.beta`) sætter
`"run_worker_first": ["/auth/*", "/api/*"]` — for enhver anden sti (`/`,
`/privacy`, `/terms`, JS/CSS-bundles, ikonfiler) serverer Cloudflares
Assets-binding filen **direkte fra edgen, uden at Worker-scriptet
nogensinde kaldes**. Bekræftet af den eksisterende kommentar i
`wrangler.jsonc` om netop dette (`run_worker_first` blev tilføjet, fordi
`/auth/*` ellers aldrig blev nået). `server/index.test.ts` tester kun
headers på `/api/health` — ingen test dækker den statiske sti.

Live-verifikation af `https://boholtsfamilyplatform-beta.nicolajbach12.workers.dev/`
kunne ikke gennemføres fra dette miljø (udgående HTTPS til `*.workers.dev`
blokeres af sandboxens netværks-allowlist — `curl` fejlede med 403 fra
proxyen, ikke fra Cloudflare). Fundet hviler derfor på kodeanalyse af
`wrangler.jsonc`s `run_worker_first`-liste og Cloudflares egen
dokumentation (se nedenfor), ikke på en live header-måling. **Nicolaj bør
selv bekræfte med `curl -I https://boholtsfamilyplatform-beta.nicolajbach12.workers.dev/`
efter deploy**, at `/` nu returnerer de samme headers som `/api/health`.

Løsning valgt (mindst risikabel, ingen runtime-kodeændring): en
`public/_headers`-fil (Cloudflare Pages-kompatibel syntaks, understøttet af
Workers Static Assets). Ifølge Cloudflares dokumentation
(https://developers.cloudflare.com/workers/static-assets/headers/) gælder
`_headers`-filen **kun** for responses, Cloudflare selv genererer fra
statiske filer — den påvirker IKKE Worker-genererede responses, så der er
ingen konflikt eller dobbelt-header-risiko med den eksisterende Hono-
middleware på `/api/*`/`/auth/*`. Vite kopierer `public/`-indhold
uændret til `dist/` (`copyPublicDir`, standard slået til), så filen kræver
ingen build-ændring.

### A4. Branding: "Boholts Familieapp"/"Boholts Family Platform" forekommer 23 steder

Brugerrettede forekomster, der SKAL ændres:
- `index.html`: `<title>`, `<h1>` i noscript-fallback.
- `vite.config.ts`: PWA-manifest `name`/`short_name` ("Boholts").
- `src/pages/LoginPage.tsx`: synlig `<h1>`.
- `src/pages/LegalPage.tsx`: "Boholts Familieapp", "Boholts Family
  Platform's use and transfer..." (Google-klausulens navn — se risiko
  nedenfor).
- `src/features/calendar/preferences/dataBackupStorage.ts`: fejlbesked
  "Filen er ikke en gyldig Boholts Familie-backup."
- `src/features/settings/components/AccountDataSection.tsx`: backup-
  filnavn `boholts-familie-backup-*.json`.
- `README.md` (rod), `05_App/web/README.md`: titler/beskrivelser.

Tekniske ressourcenavne, der IKKE må ændres i denne omgang (kræver egen
migrationsplan, jf. `wrangler.jsonc`s egen kommentar om at et tidligere
forsøg på at omdøbe Worker-`name` blev rullet tilbage, fordi Workers
Builds er bundet til den eksisterende Worker-ressource, ikke feltet):
- `wrangler.jsonc`: `name: "boholtsfamilyplatform"`,
  `env.beta.name: "boholtsfamilyplatform-beta"`.
- D1 `database_name`/`database_id` (begge miljøer).
- Google/Microsoft OAuth-klient-id'er, redirect-URI'er
  (`boholtsfamilyplatform(.beta)?.nicolajbach12.workers.dev/auth/...`).
- Secrets Store-navne, GitHub-repo-navn.
- `localStorage`-nøglepræfikset `boholts-family-` i
  `dataBackupStorage.ts`/`calendarMemberMappingStorage.ts` m.fl. — dette
  er et internt lagringsnøgle-format, IKKE brugerrettet tekst; en
  ændring ville kræve en migreringsplan for eksisterende brugeres
  gemte data og er ude af scope.
- `google1e28839311687158.html` (Search Console-verifikationsfil).

**Risiko identificeret:** `LegalPage.tsx` citerer Googles krævede
Limited-Use-erklæring ordret med firmanavnet indlejret: *"Boholts Family
Platform's use and transfer of information received from Google APIs..."*.
Dette er teksten, Google selv godkendte ved OAuth-verificeringen (jf.
Sprint 44-planen). At ændre firmanavnet i denne specifikke sætning kan
kræve fornyet Google-gennemgang. Løsning: erstat den engelske sætning med
en generisk formulering, der navngiver appen som "Hjemmecentralen (tidligere
Boholts Family Platform)" og bevar Google-kravets indhold uændret — flages
eksplicit til Nicolaj som en beslutning, der bør bekræftes før produktions-
deploy, ikke kun beta.

### A5. Dokumentationsdrift — bekræftet, alvorligt

- **`CHANGELOG.md`** (rod) stopper ved "Sprint 37" — intet er tilføjet for
  Sprint 38-48 (måltidsplan, lommepenge, fødselsdage/gaver, fællesøkonomi,
  danske skoleferier, kiosk-dashboard, main/beta Google-adskillelse,
  URL-omdøbningsforsøg, iOS-plan, iCloud CalDAV, Microsoft-login,
  login-redesign), selvom alle disse er implementeret og merget til `main`
  (bekræftet ved `git log`).
- **`PROJECT_STATUS.md`** (rod) er selv-erklæret forældet siden
  2026-08-27 og dækker end ikke det. "Leveret"-listen mangler alt fra
  Sprint 30 og frem.
- **`README.md`** (rod og `05_App/web/README.md`) "Leveret"-lister stopper
  samme sted som CHANGELOG.
- **`47_Sprint47_iCloud_Kalender_CalDAV_Plan.md`** har stadig
  `Status: Idé-/planlægningsstadie — intet af nedenstående er påbegyndt
  endnu`, selvom iCloud CalDAV er fuldt implementeret og merget til `main`
  (commits `f487086`, `fa51c46`, `dd6b34f`, merget via PR #225/#226).
  Præcis det eksempel, opgavebeskrivelsen forudsagde.
- **`48_Sprint48_...Plan.md`**'s statuslinje siger "afventer PR/Beta-
  deploy" for Del A (Microsoft-login), men commits herfra er allerede
  merget til `main` (`56a3bdd`, `c78a753`, `67039d5`, `9d0e888`, merget via
  PR #229-#233). Del B (Apple) er korrekt markeret som ikke påbegyndt —
  bekræftet: `AppleIcon`-knappen er `disabled` med badge "Kommer senere".

---

## B. Berørte filer

**Juridiske tekster (A1/A2):**
- `05_App/web/src/pages/LegalPage.tsx`

**Sikkerhedsheaders (A3):**
- `05_App/web/public/_headers` (ny fil)
- `05_App/web/server/index.test.ts` (udvidet test, dokumenterer at
  Worker-headers stadig virker uændret — selve `_headers`-filens effekt på
  statiske assets kan ikke testes af Vitest, da det er en Cloudflare-edge-
  adfærd; dækkes af en kommentar + Nicolajs manuelle live-verifikation)

**Branding (A4):**
- `05_App/web/index.html`
- `05_App/web/vite.config.ts`
- `05_App/web/src/pages/LoginPage.tsx`
- `05_App/web/src/pages/LegalPage.tsx`
- `05_App/web/src/features/calendar/preferences/dataBackupStorage.ts`
- `05_App/web/src/features/settings/components/AccountDataSection.tsx`
- `README.md`, `05_App/web/README.md`

**Dokumentation (A5):**
- `CHANGELOG.md`, `PROJECT_STATUS.md`, `README.md` (rod)
- `01_Project_Documentation/Development/47_...Plan.md` (statuslinje)
- `01_Project_Documentation/Development/48_...Plan.md` (statuslinje)

**Nye plandokumenter (ikke-implementeret):**
- `01_Project_Documentation/Development/50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md`
- `01_Project_Documentation/Development/51_Barnets_Hjemmecentral_Plan.md`

---

## C. Risici

1. **Google Limited-Use-klausul** (A4) — navneændring i den citerede
   engelske sætning kan i teorien udløse fornyet Google-gennemgang.
   Mitigeret ved at bevare klausulens indhold og kun tilføje det nye navn
   som en parentetisk forklaring, men flages til Nicolaj som en beslutning
   der bør tjekkes før produktions-deploy.
2. **`_headers`-filen kan ikke testes automatisk** — Cloudflares
   dokumenterede adfærd (headers på statiske assets, ikke på
   Worker-responses) er velunderbygget, men kan kun endeligt bekræftes
   med en live `curl` mod beta efter deploy, hvilket denne sandbox ikke
   kan udføre (netværksblokering). Risikoen mitigeres ved at vælge den af
   Cloudflare selv anbefalede, ikke-runtime-ændrende løsning frem for at
   ændre Worker-routing (som ville kunne påvirke OAuth-navigation).
3. **PWA-manifest-navneændring** (A4) kan kræve, at eksisterende
   installerede PWA'er (Nicolaj og Christines hjemmeskærm-ikon) geninstal-
   leres for at vise det nye navn — ikke en breaking change, men en
   synlig UX-detalje at nævne ved deploy.
4. **Ingen destruktiv logik ændres.** Eksport-/sletningsomfanget (A2) er
   bevidst IKKE udvidet i denne omgang — kun tekst rettet til at beskrive
   nuværende adfærd. Ingen risiko for datatab.

---

## D. Teststrategi

- `npm ci`, `npm run lint`, `npm run build`, `npm test`,
  `npm audit --omit=dev` fra `05_App/web`.
- `npm run test:e2e` (Playwright) — hvis Chromium-browseren ikke er
  installeret i miljøet, skelnes eksplicit mellem "browser mangler" og en
  reel testfejl (se rapport i TEST-fasen).
- Ny/udvidet test i `server/index.test.ts`, der bekræfter at de
  eksisterende sikkerhedsheader-assertions på `/api/health` fortsat
  består uændret efter tilføjelsen af `public/_headers` (dvs. at
  Worker-middlewaren ikke er blevet fjernet eller svækket ved en fejl).
- Manuel/dokumenteret verifikation efter merge, som Claude ikke selv kan
  udføre herfra: `curl -I` mod live beta-URL for `/`, `/privacy`,
  `/api/health`, `/auth/google/begin`, for at bekræfte at `_headers`
  faktisk anvendes af Cloudflare i praksis.
- Secrets-scan: `git grep` efter e-mail/nøgle-mønstre i diffen før commit.
- Visuel/tekstuel gennemgang: ingen resterende "Boholts"-forekomster i
  brugerrettede strenge (grep efter commit, tekniske filer undtaget).

---

## E. Commit-opdeling

1. `fix(legal): align privacy and terms with current data handling`
2. `fix(security): add security headers to static app shell via _headers`
3. `feat(branding): rename user-facing app to Hjemmecentralen`
4. `docs: align project status and changelog with implemented features`
5. `docs(product): plan full data export/account deletion and Barnets Hjemmecentral`

---

## F. Hvad der bevidst IKKE implementeres nu

- **Komplet server-side dataeksport** (familie, opgaver, indkøb, økonomi,
  måltidsplan fra D1) og **kontosletning** — kræver egen teknisk plan
  (`50_...Plan.md`), inkl. bekræftelsesflow, genautentificering,
  konsekvensvisning og tests, før implementering. Ikke bygget i dette
  arbejdspakke, jf. opgavens eksplicitte afgrænsning.
- **Familiesletning** — samme afgrænsning som ovenfor.
- **Teknisk infrastruktur-omdøbning** (Worker-navn, D1-navn, repo-navn,
  OAuth-redirects) — kræver egen migrationsplan og ny Cloudflare/Google/
  Microsoft-ressourceoprettelse; eksplicit udelukket af opgaven.
- **Barnets Hjemmecentral** — kun plan (`51_...Plan.md`), ingen kode.
- **Rettelse af markedsføringstekst** på `LoginPage.tsx`'s feature-kort
  ("synkroniseret med Google og Outlook") i lyset af at Outlook-kalender
  er midlertidigt slået fra — dette er en produktbeslutning (skal teksten
  nedtones, eller er "Outlook" her tilstrækkeligt dækket af "kommer
  tilbage snart"?) og efterlades til Nicolaj; nævnes som observation, ikke
  rettet i denne omgang, for at holde branding-commit'en fokuseret på
  navneskift.
