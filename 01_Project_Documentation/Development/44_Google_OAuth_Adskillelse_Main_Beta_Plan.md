# 44_Google_OAuth_Adskillelse_Main_Beta_Plan

> Status (2026-09-11): Trin 1-7 udført. Første verificeringsforsøg
> (trin 6) blev afvist af Google med fire punkter — tre rettet i koden
> (forside, privatlivspolitik, noscript-fallback), alle nu live i
> produktion (`main`). Trin 7 (`google-client-secret-main`) er oprettet
> i Cloudflares Secrets Store — Google-login på `main` virker. Trin 8
> (domæneverificering i Google Search Console) er gennemført af
> Nicolaj — det løser Googles fjerde afvisningspunkt.
>
> Efter branding blev genindsendt til verificering, fandt Google en
> femte, ny uoverensstemmelse: OAuth-samtykkeskærmens **App name**-felt
> stod som "Boholts Family Platform" (det interne Google Cloud-
> projektnavn), mens appens faktiske, synlige navn er "Boholts
> Familieapp" (forside, `<title>`, noscript-fallback). Rettet ved at
> ændre App name-feltet i Google Cloud Console (Branding-siden) til
> "Boholts Familieapp" — ingen kodeændring nødvendig. Branding er nu
> verificeret ("Your branding has been verified and is being shown to
> users").
>
> Afventer: Googles fulde gennemgang af selve OAuth-samtykkeskærmen
> (sensitive scopes) efter genindsendelse — kan tage fra dage til uger.

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-10

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Gøre det muligt at sende `main` (produktionsmiljøet) gennem Googles
OAuth-verificeringsproces — nødvendig for at kunne dele appen med
brugere udenfor familien — uden at det påvirker `beta`, som familien
bruger dagligt, mens verificeringen (typisk dage til uger) står på.

---

## Nuværende opsætning (bekræftet direkte i `wrangler.jsonc`)

- `main` (det unavngivne miljø) og `beta` deler i dag **nøjagtig samme**
  Google OAuth-klient:
  - Samme `GOOGLE_CLIENT_ID` (se `wrangler.jsonc`s `vars`-blok — ikke
    gentaget her, for at undgå at have identifikatorer liggende dobbelt)
    i begge `vars`-blokke.
  - Samme `GOOGLE_CLIENT_SECRET`, hentet fra samme
    `secret_name: "google-client-secret"` i samme Secrets Store
    (`store_id: 2bc6325a385d4ca3bc555d66f5453a21`) — det er ikke to
    forskellige hemmeligheder, der tilfældigvis matcher, det er
    bogstaveligt den samme.
- `redirect_uri` udregnes DYNAMISK af serveren ud fra requestens eget
  domæne (`server/routes/auth.ts`: `` `${new URL(c.req.url).origin}/auth/google/callback` ``)
  — ingen kodeændring nødvendig for at understøtte to miljøer, kun at
  hvert miljøs faktiske URL er registreret som en autoriseret
  redirect-URI på den rette klient i Google Cloud Console.
- `/privacy` og `/terms` findes allerede i appen (bekræftet i
  `13_Release_And_Security_Baseline.md`) — dækker det branding-krav,
  Google stiller til verificeringen.

---

## Valgt tilgang (Nicolajs beslutning, 2026-09-10)

Behold den EKSISTERENDE klient til `beta` (kosmetisk omdøbt, så det er
tydeligt hvad den bruges til) — undgår at hele familien skal
gentilslutte deres Google-konti, da refresh tokens kun udstedes ved
FØRSTE samtykke pr. bruger+scope-kombination (jf. ADR-018's
konsekvensafsnit). Opret i stedet en helt NY klient, dedikeret til
`main`, som sendes til Googles verificering.

---

## Vigtigt forbehold — læs dette FØR trin 2 nedenfor

Googles OAuth-samtykkeskærm (appnavn, logo, scopes, verificerings- og
udgivelsesstatus) er, så vidt jeg er bekendt med Google Cloud, en
indstilling PR. GOOGLE CLOUD-PROJEKT — ikke pr. enkelt OAuth-klient.
Flere klient-ID'er inde i samme projekt deler samme samtykkeskærm og
samme udgivelsesstatus.

**Det betyder: at oprette en ny klient-ID inde i det SAMME Google
Cloud-projekt, som `beta`s eksisterende klient allerede ligger i, giver
formentlig IKKE reel isolation** — sender du det projekts samtykkeskærm
til verificering, ændrer det status for hele projektet, inklusive den
klient `beta` bruger.

For reel isolation (den, du beder om — at beta kan "hygge sig" uforstyrret,
mens main venter på Google) bør den nye klient til `main` derfor oprettes i
et **HELT NYT, separat Google Cloud-projekt** — ikke blot en ny klient i
det eksisterende. Jeg er ikke 100 % sikker på at dette stadig er
korrekt (Googles konsol ændrer sig), så **bekræft det selv i Google
Cloud Console, før du går videre** — under "APIs & Services" ser du,
om samtykkeskærmen (OAuth consent screen) er knyttet til projektet som
helhed eller kan sættes op flere gange pr. projekt.

---

## Navngivning (til at kopiere undervejs)

Konsekvent med den engelske stil, resten af projektet allerede bruger
(`boholtsfamilyplatform`, `boholtsfamilyplatform-beta`) — Google
Cloud-projekt-ID'er tillader alligevel ikke danske bogstaver (æ/ø/å).

| Ting | Navn/værdi |
| --- | --- |
| Eksisterende OAuth-klient (omdøbes) | `Boholts Family Platform — Beta` |
| Nyt Google Cloud-projekt, visningsnavn | `Boholts Family Platform — Main` |
| Nyt Google Cloud-projekt, projekt-ID (forslag — Google tilføjer selv et tal, hvis det er optaget) | `boholts-family-platform` |
| Ny OAuth-klient i det nye projekt | `Boholts Family Platform — Main` |
| Nyt secret-navn i Cloudflares Secrets Store | `google-client-secret-main` |

Projekt-ID'et kan IKKE ændres bagefter — visningsnavnet kan derimod
altid rettes senere, så det er ikke kritisk at ramme det perfekt her.

---

## Trin (i Google Cloud Console — kræver din egen adgang, ikke noget denne session kan udføre)

### 1. Omdøb den eksisterende OAuth-klient (bliver `beta`s)

1. Åbn direkte: **[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)**
   — sørg for at det EKSISTERENDE projekt er valgt (projekt-vælgeren
   øverst til venstre, ved siden af "Google Cloud"-logoet), hvis linket
   ikke selv rammer det rigtige.
2. Under "OAuth 2.0 Client IDs" finder du den klient, hvis Client ID
   matcher `621931405628-lc7afq5qp0ejmdks5hl9c6b7uclskiie...` — klik på
   navnet/blyant-ikonet for at redigere.
4. Skift feltet **Name** til `Boholts Family Platform — Beta` → **Save**.
   Client ID og Client Secret ændres IKKE af dette — kun navnet, der
   kun er synligt for dig i konsollen.

### 2. Opret det nye Google Cloud-projekt (til `main`)

1. Åbn direkte: **[console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate)**
2. **Project name**: `Boholts Family Platform — Main`.
3. **Project ID**: ret det til noget i stil med `boholts-family-platform`
   (Google foreslår selv noget, hvis dit ønskede navn er optaget — det
   er kun synligt for dig, ikke et problem hvis det bliver grimt).
4. **Create** → vent til projektet er oprettet, og skift til det via
   projekt-vælgeren (det skifter ikke automatisk).

### 3. Aktivér Google Calendar API i det nye projekt

1. Med det NYE projekt valgt (skift via projekt-vælgeren først), åbn
   direkte: **[console.cloud.google.com/apis/library/calendar-json.googleapis.com](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)**
2. Klik **Enable**. (Appen beder kun om `calendar.events` og
   `calendar.calendarlist.readonly` — begge dækkes af denne ene API,
   ingen andre APIs skal aktiveres.)

### 4. Sæt OAuth-samtykkeskærmen op i det nye projekt

1. Åbn direkte (med det NYE projekt valgt): **[console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)**
2. **User Type**: **External** (samme som det eksisterende projekt
   formentlig allerede bruger, da familien logger ind med almindelige
   private Google-konti, ikke et Google Workspace-domæne).
3. Udfyld:
   - **App name**: `Boholts Family Platform`
   - **User support email**: din egen e-mail
   - **App logo**: valgfrit, men anbefales — Google ser mere seriøst på
     ansøgninger med et rigtigt logo
   - **App domain → Application home page**: main's faktiske URL (se
     åbent spørgsmål nedenfor)
   - **Application privacy policy link**: `https://<main-domænet>/privacy`
   - **Application terms of service link**: `https://<main-domænet>/terms`
   - **Authorized domains**: main's domæne uden `https://` og uden sti
     (fx `boholtsfamilyplatform.dk` eller `<noget>.workers.dev`, alt
     efter hvad den faktiske URL er)
   - **Developer contact information**: din egen e-mail
4. **Save and continue** gennem "Scopes"-siden: tilføj `.../auth/calendar.events`
   og `.../auth/calendar.calendarlist.readonly` (openid/email/profile
   er allerede med som standard) — samme scopes som det eksisterende
   projekt.
5. **Save and continue** gennem "Test users": tilføj din egen konto
   (og evt. andre, der skal kunne teste `main`, før Google godkender).

### 5. Opret den nye OAuth-klient (til `main`)

1. Åbn direkte (med det NYE projekt valgt): **[console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)**
   → **+ Create Credentials → OAuth client ID**.
2. **Application type**: **Web application**.
3. **Name**: `Boholts Family Platform — Main`.
4. **Authorized redirect URIs → + Add URI**:
   `https://<main-domænet>/auth/google/callback` (den faktiske URL for
   produktionsmiljøet — se åbent spørgsmål nedenfor, jeg kender ikke
   denne værdi).
5. **Create** → et vindue viser det nye **Client ID** og **Client
   Secret**. Kopiér begge — Client Secret vises kun denne ene gang (du
   kan altid se Client ID senere, men skal generere et nyt Secret, hvis
   du mister det).

### 6. Send til verificering

**Anbefalet rækkefølge: gør trin 7 (secret i Cloudflare) FØRST** — så
virker `main`s login med det samme, næste gang koden deployes, uanset
hvor lang tid trin 6 (Googles review) tager. Trin 6 kan roligt vente,
uden det bremser noget andet.

1. Åbn **[console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)**
   — sørg for at det NYE projekt (`boholts-family-platform-main`) er
   valgt i projekt-vælgeren øverst.
2. Klik knappen **Publish App** (normalt øverst i "Publishing status"-
   sektionen). Der kommer en bekræftelsesdialog, der fortæller at appen
   flytter fra "Testing" til "In production", og at Google vil kigge
   appens brug af sensitive scopes igennem — bekræft.
3. Da appen beder om Calendar-scopes (`calendar.events`,
   `calendar.calendarlist.readonly` — klassificeret som "sensitive",
   ikke "restricted", så ingen betalt sikkerhedsvurdering er nødvendig),
   viser Google typisk et ekstra trin/link til selve
   verificeringsansøgningen. Følg det, og forbered:
   - En kort skærmoptagelse (fx med telefonens eller computerens
     indbyggede skærmoptager), der viser: log ind med Google i appen →
     samtykkeskærmen → en kalenderhandling i appen (fx opret en aftale,
     og vis den derefter i selve Google Kalender for at bevise
     synkroniseringen).
   - En kort skriftlig begrundelse for hvorfor appen har brug for
     kalender-adgang (én-to sætninger er ofte nok: "Appen er en
     familiekalender, der læser og skriver aftaler til brugerens Google
     Kalender, så familien kan se og planlægge fælles aftaler ét sted.").
4. Indsend. Herfra er det udelukkende Google, der arbejder — kan tage
   fra få dage til flere uger. Du får besked på den e-mail, der står som
   "Developer contact information" på samtykkeskærmen.

### 7. Læg det nye secret i Cloudflares Secrets Store

Jeg kan ikke give et præcist deep-link til selve Secrets Store-siden,
da den kræver dit konto-specifikke account-ID, som jeg ikke kender —
men her er den mest udførlige vej, jeg kan give dig:

1. Åbn **[dash.cloudflare.com](https://dash.cloudflare.com/)** og log
   ind, hvis du ikke allerede er det.
2. Er du medlem af mere end én Cloudflare-konto, skal du sikre dig, at
   du står i den rigtige (kontovælgeren står typisk øverst til venstre,
   ved siden af Cloudflare-logoet).
3. Cloudflares dashboard flytter til tider rundt på Secrets Store i
   venstremenuen — den mest robuste måde at finde den på er
   søgefeltet/kommando-paletten øverst i dashboardet (et forstørrelsesglas-
   ikon, eller genvejstasten **⌘K**/**Ctrl+K**): skriv **"Secrets
   Store"** og vælg resultatet. Alternativt: kig i venstremenuen efter
   enten en selvstændig **"Secrets Store"**-post, eller under
   **"Workers & Pages"**.
4. På Secrets Store-siden ser du en liste over dine "stores" (bokse med
   secrets). Find den, hvis ID matcher `2bc6325a385d4ca3bc555d66f5453a21`
   — det kan være den eneste, du har, eller den kan have et navn i
   stedet for at vise ID'et direkte; klik ind på den, der allerede
   indeholder secrets som `google-client-secret`,
   `google-token-encryption-key` osv. (du kan se listen over
   eksisterende secret-navne for at bekræfte, det er den rigtige).
5. Klik **+ Add secret** (eller tilsvarende "opret ny"-knap).
6. **Secret name**: `google-client-secret-main` (præcis denne
   stavning — det er det navn, `wrangler.jsonc` allerede henviser til).
7. **Value**: indsæt Client Secret'en fra den JSON-fil, Google lod dig
   downloade i trin 5 (feltet `client_secret`) — den gengives bevidst
   ikke her i dokumentet.
8. Gem/opret secret'en.
9. Rør IKKE det eksisterende `google-client-secret` — `beta` skal
   blive ved med at pege på det uændret.
10. Næste gang `main` deployes (fx via et Git-udløst Workers Build,
    eller `wrangler deploy` uden `--env`-flag), tager den nye
    `GOOGLE_CLIENT_ID` og det nye secret i brug automatisk — ingen
    yderligere handling nødvendig fra din side.

### 8. Verificér ejerskab af domænet i Google Search Console

Googles første verificeringsforsøg af `main` blev afvist med fire
punkter (2026-09-11) — tre er rettet i koden (se
`git log` for commit "Ret tre af Googles fire verificeringsindsigelser
mod main"). Det fjerde ("home page URL is not registered to you")
kræver dette trin.

Da `main` kører på en `workers.dev`-subdomæne, ikke et domæne du selv
har DNS-kontrol over, er **DNS-baseret verificering ikke en mulighed**
— brug i stedet **HTML tag**-metoden, som kun kræver at du kan redigere
sidens `<head>` (det kan jeg gøre for dig, når du har koden fra Google).

1. Åbn **[search.google.com/search-console](https://search.google.com/search-console)**
   og log ind med den samme Google-konto, du bruger til Google Cloud
   Console.
2. Klik **Add property** (eller **Tilføj egenskab**, hvis konsollen
   viser dansk).
3. Vælg fanen **URL prefix** (IKKE "Domain" — den kræver DNS-kontrol,
   som du ikke har over `workers.dev`).
4. Indtast præcis: `https://boholtsfamilyplatform.nicolajbach12.workers.dev/`
   → **Continue**.
5. Google viser flere verificeringsmetoder — vælg **HTML tag**
   (udfold den, hvis den er skjult under "Other verification methods").
6. Kopiér den `<meta name="google-site-verification" content="...">`-tag,
   Google viser dig.
7. **Send mig indholdet af `content="..."`-værdien** (kun selve koden,
   ikke nødvendigvis hele tagget) — jeg lægger den ind i `index.html`s
   `<head>`, committer og pusher. Når `main` er deployet med ændringen
   (Git-udløst deploy, eller bed mig bekræfte at den er i produktion),
   går du tilbage til Search Console og klikker **Verify**.
8. Når Search Console viser ejerskabet som bekræftet, gå tilbage til
   OAuth-samtykkeskærmens **Branding**-side (trin 4's link) og bekræft
   at hjemmesiden nu er markeret som verificeret der også — herefter
   kan du gentage trin 6 (Publish App / anmod om ny gennemgang).

---

## Det jeg selv kan gøre, når trin 1-7 er udført

- Opdatere `wrangler.jsonc`'s øverste (main/unavngivne) `vars.GOOGLE_CLIENT_ID`
  til den nye klients ID.
- Opdatere samme steds `secrets_store_secrets`-liste, så
  `GOOGLE_CLIENT_SECRET`-bindingen peger på det nye secret-navn i
  stedet for det delte.
- Lade `env.beta`-blokken i `wrangler.jsonc` forblive 100 % uændret.
- Køre `npx tsc -b`/`npm run build` for at bekræfte intet andet i koden
  antager, at de to miljøer deler klient (bekræftet i gennemgangen af
  `server/routes/auth.ts`, at det ikke gør).

---

## Mens verificeringen står på

- `main` forbliver i "Testing"-tilstand under hele reviewet — kun
  eksplicit tilføjede testbrugere kan logge ind, indtil Google
  godkender. Påvirker ikke `beta`.
- Skift ALDRIG `beta` til at pege på den nye klient, før verificeringen
  er færdig og bekræftet stabil i praksis — hele pointen med denne plan
  er isolation.

---

## Åbne spørgsmål til Nicolaj

- **Hvad er den faktiske produktions-URL for `main` i dag?**
  (workers.dev-adresse, eller et tilkoblet eget domæne — nødvendig for
  redirect-URI'en i trin 2. Ikke synlig i `wrangler.jsonc`, da der ikke
  er nogen `routes`/custom domain konfigureret der.)
- **Er samtykkeskærmen reelt pr.-projekt, som beskrevet i forbeholdet
  ovenfor?** Afgør om trin 2 kræver et helt nyt projekt (som denne plan
  antager) eller om en ny klient i det eksisterende projekt rent
  faktisk er nok — bekræft direkte i Google Cloud Console, da jeg ikke
  har adgang til at tjekke det selv.

---

## Kvalitetsgate

Ingen kodeændring før Nicolaj har gennemført trin 1-7. Når secret og
Client ID er klar: `npx tsc -b`, `npm run build` grønne efter
`wrangler.jsonc`-opdateringen — ingen ny migration, ingen e2e-relevans
(rent driftskonfiguration).
