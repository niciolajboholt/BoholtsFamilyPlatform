# 44_Google_OAuth_Adskillelse_Main_Beta_Plan

> Status: Forslag — venter på at Nicolaj udfører trinnene i Google Cloud
> Console (uden for denne sessions adgang) og bekræfter de åbne
> spørgsmål nedenfor.

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
  - Samme `GOOGLE_CLIENT_ID`
    (`621931405628-lc7afq5qp0ejmdks5hl9c6b7uclskiie.apps.googleusercontent.com`)
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

1. Tilbage på **[console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)**
   (samme side som trin 4): klik **Publish App**, som
   flytter appen fra "Testing" til "In production" — dette udløser
   Googles krav om verificering, fordi appen beder om sensitive scopes
   (Calendar).
2. Følg guiden Google viser dig herfra — den beder typisk om en kort
   skærmoptagelse, der viser præcis hvordan appen bruger
   kalender-adgangen. Kan tage fra dage til flere uger.

### 7. Læg det nye secret i Cloudflares Secrets Store

1. Åbn **[dash.cloudflare.com](https://dash.cloudflare.com)** — jeg kan
   ikke give et direkte deep-link hertil, da det kræver din
   konto-specifikke account-ID, som jeg ikke kender. Naviger til
   **Workers & Pages → Secrets Store** (eller det relevante
   account-niveau, afhængig af hvor `2bc6325a385d4ca3bc555d66f5453a21`-
   storen ligger).
2. Opret et nyt secret med navnet `google-client-secret-main` og
   værdien = det Client Secret, du kopierede i trin 5.
3. Rør IKKE det eksisterende `google-client-secret` — `beta` skal
   blive ved med at pege på det uændret.

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
