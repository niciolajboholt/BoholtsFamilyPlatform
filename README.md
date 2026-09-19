# Hjemmecentralen (kodenavn: Boholts Family Platform)

Hjemmecentralen er en Apple-first familieplatform, som samler familiens
aftaler, indkøbslister og opgaver i én mobilvenlig webapp — delt på tværs
af familiemedlemmernes devices. "Boholts Family Platform" er det oprindelige
interne navn — det lever videre i repositoryets navn, Cloudflare Worker- og
D1-ressourcenavne og OAuth-konfiguration (se `05_App/web/wrangler.jsonc`),
som ikke omdøbes uden en separat migrationsplan.

## Aktuel status

Platformen er en Cloudflare Worker (Hono) med en D1-database og en
React/TypeScript/Vite-klient (ADR-017, Sprint 20). Leveret indtil videre:

- Server-ejet login med Google eller Microsoft (PKCE, krypterede tokens i
  D1, Sprint 48). Outlook-KALENDER-integrationen (MSAL, klient-side) findes
  i koden, men er for øjeblikket midlertidigt slået fra pga. en
  Azure-tenant-begrænsning.
- iCloud-kalender via CalDAV (app-specifik adgangskode, krypteret
  server-side) og read-only ICS-kalenderabonnementer (Sprint 47).
- Familier: oprettelse, invitationer, medlemskab (ejer/admin/medlem).
- Måneds-, uge- og dagsvisning af kalenderaftaler — alle aftaler ejes af en
  ekstern kalender (Google/Outlook).
- Kalender-til-familiemedlem-tildeling, delt på tværs af familiens devices.
- Web Push (VAPID)-notifikationer ved nye/ændrede/slettede aftaler, nye
  varer på indkøbslisten og nye opgaver.
- Flere navngivne, typede indkøbslister (dagligvarer/byggemarked/andet) med
  selvlærende dansk kategori-ordbog pr. familie og type.
- Tiimo-inspireret opgaveløsning: engangsopgaver og faste rutiner
  (dovent materialiseret dag for dag), personlige eller familie-rettede.
- Et AI-modul via Cloudflare Workers AI (ikke en ekstern udbyder — data
  forlader ikke Cloudflares infrastruktur), der foreslår rutiner ud fra
  fritekst og indkøbsliste-ingredienser ud fra en ret. Forslag gemmes aldrig
  automatisk — altid en menneskelig godkendelse.
- Inkrementel Google-kalendersynk (`nextSyncToken`, delta-flet med
  fuld-synk-fallback) og et rigtigt PNG-ikonsæt til PWA'en (Sprint 25).
- Vedvarende visuel konfliktmarkering i alle kalendervisninger, og en
  read-only delelink til udvalgte familiemedlemmers kalendere for
  udenforstående uden login (Sprint 26).
- Tidsbaserede opgave-påmindelser — en push-notifikation når en opgaves
  tidspunkt indtræffer (Sprint 27).
- Et AI-genereret ugentligt familieresumé, sendt automatisk hver søndag
  (Sprint 28).
- Sikkerhedshærdning: CSP og andre sikkerhedsheaders (både på API'et via
  Hono-middleware og på den statiske appskal via `public/_headers`),
  rate-limiting på AI-ruter/push-abonnement/delelinks, migrations-synlighed
  i `/api/health`, global Error Boundary (Sprint 29, udvidet Sprint 49).
- Måltidsplanlægning med AI-genererede indkøbsforslag (Sprint 38).
- Opgavebelønning/lommepenge med saldo-overblik pr. barn (Sprint 39).
- Fødselsdage og gaveidé-planlægning (Sprint 40).
- Fællesøkonomi (delte udgifter) mellem forældre (Sprint 41).
- Kiosk-dashboard: en navigationsfri visning af dagens aftaler, opgaver og
  indkøbsliste (Sprint 43).
- Server-side fuld dataeksport (rolleafhængigt omfang) og to-trins konto-/
  familiesletning med gen-autentificering og 30 dages fortrydelsesperiode
  (Sprint 50).
- Barnets Hjemmecentral (roadmap i
  `01_Project_Documentation/Development/51_Barnets_Hjemmecentral_Plan.md`):
  en valgfri "Mit i dag"-side pr. familiemedlem (Sprint 52); sikker
  børneadgang på et barns EGEN, ikke-logget-ind enhed via link + 4-cifret
  PIN-kode (Sprint 53); faste rutineskabeloner i "Opret rutine" (Sprint 54).

Danske skoleferier (Sprint 42) er kun research, ikke bygget. Native
iOS-app (Sprint 46) og Apple-login findes kun som plan. Barnets
Hjemmecentrals øvrige faser (oplæsning, valgfrit point-/mållag, guidede
Aula/DBU Kampklar/Holdsport-forbindelser) er også kun plan. Se
[CHANGELOG.md](CHANGELOG.md) for den fulde, løbende sprint-for-sprint-liste.

Se [AI Knowledge Base](01_Project_Documentation/AI_Knowledge_Base/00_README.md)
for projektets historik, arkitektur og beslutninger, og
[10_Future_Roadmap.md](01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md)
for den planlagte udviklingsretning.

## Teknologi

**Klient:**

- React 19 og TypeScript
- Vite
- Material UI
- Vitest
- Playwright (desktop- og mobil-smoke-tests)
- PWA: manifest og service worker (`vite-plugin-pwa`)

**Server:**

- Cloudflare Workers (Hono)
- Cloudflare D1 (SQLite)
- Cloudflare Secrets Store (klienthemmeligheder, krypteringsnøgler)
- Cloudflare Workers AI (AI-modulets rutine-/ingrediensforslag)
- Web Push (VAPID)

Platformskiftet fra SwiftUI til React/PWA er dokumenteret i ADR-010, og
skiftet fra en klient-only PWA til en Cloudflare Worker + D1-backend i
ADR-017 — se
[arkitekturbeslutningerne](01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md).

## Lokal udvikling

Forudsætning: Node.js `24.15.0` eller nyere i Node 24-serien.

```bash
cd 05_App/web
npm ci
npm run dev
```

Kvalitetskontrol:

```bash
npm run lint
npm run build   # tsc -b && vite build
npm test        # Vitest
npm run test:e2e # Playwright; installér Chromium én gang med npx playwright install chromium
```

GitHub Actions kører de samme kontroller ved pull requests og pushes til
`develop` og `main`.

## Konfiguration

Google-login og -kalender er server-ejet (Sprint 20) — klienten kræver ikke
længere en Google Client ID. Outlook-kalenderen bruger (Sprint 48) den
samme delte, personlige Azure-app-registrering som Microsoft-login
(`server/lib/microsoftOAuth.ts`), hardkodet i
`outlookCalendarConfig.ts` — ingen `.env`-opsætning nødvendig for at bruge
den. `VITE_OUTLOOK_CLIENT_ID` er kun til lokal test mod en ANDEN
app-registrering; kopiér i så fald `05_App/web/.env.example` til
`05_App/web/.env.local` og sæt den der.

Serverens egne hemmeligheder (Google OAuth client secret, token-krypterings-
nøgle, VAPID privat nøgle, Resend API-nøgle, admin-e-mail) ligger i
Cloudflare Secrets Store og bindes via `05_App/web/wrangler.jsonc` — de
committes aldrig. Et nyt fork eller en ny installation kan bruge
`05_App/web/wrangler.example.jsonc` som udgangspunkt for sin egen
`wrangler.jsonc`, med placeholder-værdier i stedet for dette projekts
rigtige Cloudflare-ressource-ID'er.

## Deployment

Appen deployes som en Cloudflare Worker, forbundet direkte til dette
GitHub-repo via Cloudflare Workers Builds (git-integration):

- Push til `main` deployer produktion (`boholtsfamilyplatform`).
- Push til `develop` deployer beta (`boholtsfamilyplatform-beta`), en
  separat Worker med egen D1-database, så beta-test aldrig kan ramme rigtig
  familiedata.

`main` og `develop` er pt. IKKE synkroniserede — `develop` er ikke merget
til `main` siden PR #228 (2026-09-13). "Aktuel status" ovenfor beskriver
den samlede kodebase, ikke nødvendigvis hvad der kører i produktion netop
nu; se [PROJECT_STATUS.md](PROJECT_STATUS.md) for den verificerede
fordeling mellem `main` og `develop`.

Se `05_App/web/wrangler.jsonc` for den fulde konfiguration (D1-binding,
Secrets Store-bindinger, Workers AI-binding, versionsmetadata, assets og
observability). D1-migrationer
anvendes **ikke** automatisk af Cloudflare Workers Builds — de skal køres
manuelt via D1-konsollens SQL-editor på både beta og produktion, og
resultatet skal verificeres direkte (`SELECT ... FROM sqlite_master`), ikke
kun antages. Se lektionen herom i
[09_Lessons_Learned.md](01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md).

## Repository-strategi

- `develop` er integrationsbranch for valideret udvikling.
- `main` er releasebranch og repositoryets default branch.
- Ændringer leveres via branches og pull requests.

Dokumentationen vedligeholdes som Markdown i repositoryet.
