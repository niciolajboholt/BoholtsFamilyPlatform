# 45_Sprint45_Main_Omdoebning_Navn_URL_Plan

> Status (2026-09-11): Plan udarbejdet, IKKE påbegyndt. Afventer bevidst
> Googles afgørelse på den igangværende OAuth-verificering (se
> `44_Google_OAuth_Adskillelse_Main_Beta_Plan.md`) — et URL-skifte på
> `main` midt i den gennemgang vil med stor sandsynlighed nulstille
> den og kræve gensendelse (nyt domæneejerskab, ny redirect-URI).

Version: 1.0

Project:
Boholts Family Platform

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Nicolaj vil af med "Boholt" i appens navn og URL, så appen fremstår
mere allround og ikke bundet til én bestemt families efternavn — især
relevant nu, hvor `main` er ved at blive godkendt af Google til at
kunne deles uden for egen familie.

**Bevidst afgrænsning: kun `main` ændres.** `beta` (familiens daglige
miljø, `boholtsfamilyplatform-beta.nicolajbach12.workers.dev`) rører vi
IKKE — hverken navn, URL eller synligt appnavn. Familien skal fortsat
kunne bruge `beta` uforstyrret, uanset hvor lang tid omdøbningen af
`main` tager.

## To adskilte dele

1. **Det synlige navn** i selve appen ("Boholts Familieapp" — forside,
   `<title>`, noscript-fallback, PWA-manifest, juridiske sider,
   OAuth-samtykkeskærmens "App name"). Ren tekst-/kodeændring, ingen
   infrastrukturrisiko — kan i princippet laves uafhængigt af URL'en.
2. **Selve URL'en** (`boholtsfamilyplatform.nicolajbach12.workers.dev`).
   Nicolaj har bekræftet: fortsat et `workers.dev`-underdomæne, intet
   rigtigt købt domæne. Det er den svære del — se næste afsnit.

## Hvorfor URL'en ikke bare kan omdøbes i konfigurationen

Der findes allerede en note i `wrangler.jsonc` (linje 2-9) fra et
tidligere forsøg (2026-08-23) på præcis dette: at ændre `"name"`-feltet
gør intet ved selve URL'en, fordi Cloudflares Git-integration (Workers
Builds) er bundet til den EKSISTERENDE Worker-ressource, ikke til dette
felt i koden. Et ændret navn her opretter ikke en ny Worker og
omdirigerer intet — det bliver bare ignoreret ved deploy.

En rigtig URL-ændring kræver derfor en **helt ny Cloudflare
Worker-ressource**, oprettet fra bunden i Cloudflare-dashboardet, med
sin egen Git-tilkobling og sine egne bindings. Dette er en
dashboard-handling, der kræver Nicolajs egen adgang — ikke noget denne
session kan udføre alene.

## Foreslåede navne (til diskussion — ikke besluttet)

Allround, ikke familienavn-bundet, kort nok til en URL:

- **Fælleskalender** / `faelleskalender`
- **Familieoverblik** / `familieoverblik`
- **Husstandsappen** / `husstand`
- **Samlepunkt** / `samlepunkt`
- **Ugeplanen** / `ugeplanen`
- **Familieplan** / `familieplan`

Bemærk: `familieapp` blev allerede forsøgt reserveret 2026-08-23 (se
noten i `wrangler.jsonc`) — tjek om det stadig er ledigt som
`workers.dev`-underdomæne, hvis det er favorit, inden vi lægger os fast.
Nicolaj vælger det endelige navn; ovenstående er kun forslag.

## Trin (når Google-verificeringen er afgjort)

### 1. Vælg det endelige navn
Beslut navnet, både til visning i appen og til selve
`workers.dev`-underdomænet (de behøver ikke være identiske, men det er
mest gennemskueligt, hvis de er ens/næsten ens).

### 2. Opret den nye Cloudflare Worker-ressource
I Cloudflare-dashboardet: **Workers & Pages → Create → Import a
repository** (eller tilsvarende "connect to Git"-flow), vælg samme
GitHub-repo, samme `main`-branch. Cloudflare foreslår typisk et navn
baseret på repo'et — ret det til det valgte navn under oprettelsen.

### 3. Genbrug eksisterende ressourcer — opret INTET nyt af disse
- **D1-databasen**: samme `database_id` (`052a1416-...`) — ingen ny
  database, ingen datamigrering. Kun URL'en og Worker-ressourcen er ny,
  ikke dataene.
- **Secrets Store-secrets**: samme `store_id`
  (`2bc6325a385d4ca3bc555d66f5453a21`) og samme secret-navne
  (`google-client-secret-main`, `google-token-encryption-key`,
  `vapid-private-key`, `resend-api-key`, `admin-email`) — bindes bare
  til den nye Worker-ressource i dens egne "Bindings"-indstillinger,
  præcis som de allerede er sat op for den nuværende.

### 4. Opdatér `wrangler.jsonc`
- Top-niveauets `"name"` ændres til det nye navn.
- Alle kommentarer, der nævner den gamle URL
  (`boholtsfamilyplatform.nicolajbach12.workers.dev`), opdateres til
  den nye.

### 5. Opdatér appens synlige navn i koden
- `index.html`: `<title>` og `<noscript>`-teksten.
- `src/pages/LoginPage.tsx`: overskrift og evt. øvrig tekst.
- `src/pages/LegalPage.tsx`: hvor "Boholts Familieapp"/"Boholt" nævnes.
- PWA-manifest (`manifest.webmanifest`/tilsvarende Vite PWA-config) —
  `name`/`short_name`.
- Gennemsøg for "Boholt" bredt (`grep -ri boholt src/ index.html`) for
  at fange steder, der let overses.

### 6. Google Cloud Console (main-projektet)
- **Branding → App name**: ret til det nye synlige navn (samme
  uoverensstemmelses-fejl som sidst opstår ellers igen).
- **Clients → [main-klienten] → Authorized redirect URIs**: tilføj
  `https://<nyt-navn>.workers.dev/auth/google/callback`. Behold gerne
  den gamle et stykke tid som ekstra redirect-URI, indtil I er sikre
  på, alt virker, fjern den derefter.
- **Audience/Branding → Authorized domains**: opdatér til det nye
  `workers.dev`-underdomæne.

### 7. Google Search Console
Ny "URL prefix"-ejendom for den nye URL, verificér ejerskab (samme
HTML-fil-metode som i Sprint 44) — den gamle ejendom kan slettes
bagefter, eller bare stå urørt.

### 8. Deploy og test
Deploy den nye Worker-ressource, gennemgå hele login-flowet
(inkl. Google-samtykkeskærmen) og kalender-synkroniseringen mod den nye
URL, før den gamle tages ud af brug.

### 9. Afvikl den gamle Worker-ressource
Når alt er bekræftet virkende: slet eller pausér den gamle
`boholtsfamilyplatform`-Worker-ressource i Cloudflare-dashboardet.
Overvej om den gamle URL skal blive stående som en simpel
viderestilling et stykke tid, eller om den bare kan lukkes helt ned —
`main` bruges jf. tidligere afklaring (Sprint 28) ikke til familiens
daglige drift, kun `beta` gør, så risikoen ved en ren nedlukning er
lav.

## Kendte risici og åbne spørgsmål

- **Skal Google-verificeringen genstartes helt?** Sandsynligvis delvist
  — i hvert fald domæneverificeringen (trin 8 i Sprint 44) og
  redirect-URI'en. Uklart om selve scope-godkendelsen/branding-
  verificeringen skal gennem hele processen igen, eller om den følger
  med klientens/projektets øvrige, allerede godkendte opsætning. Bør
  afklares direkte med Google (fx via Verification Center), når vi når
  hertil.
- **`familieapp`-navnet**: kan være optaget efter forsøget 2026-08-23 —
  tjek tilgængelighed, før det vælges som endeligt navn.
- **Skal den gamle URL viderestilles, eller bare lukkes?** Ingen kendte
  eksterne links, der peger på `main`s URL i dag (ikke delt uden for
  familien endnu), så en ren nedlukning er formentlig uproblematisk —
  bekræft med Nicolaj før den slettes permanent.

## Kvalitetsgate

Som alt andet arbejde i dette repo: `npx tsc -b`, `npm run lint`,
`npm test`, `npm run build`, og en reel Playwright e2e-kørsel, før
noget committes. Denne sprint rører ingen forretningslogik — kun
statisk tekst og konfiguration — så risikoen for regressioner er lav,
men gaten køres alligevel.
