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

## Trin (i Google Cloud Console — kræver din egen adgang, ikke noget denne session kan udføre)

1. **Omdøb den eksisterende OAuth-klient** (den `beta` i dag bruger) til
   noget tydeligt, fx "Boholts Familieplatform — Beta". Kosmetisk kun —
   Client ID og Secret forbliver uændrede, `beta` kræver ingen
   kodeændring.
2. **Opret et nyt Google Cloud-projekt** (se forbeholdet ovenfor — ikke
   blot en ny klient i det eksisterende projekt), dedikeret til `main`.
   - Aktivér Google Calendar API (og øvrige APIs, appen bruger — samme
     som det eksisterende projekt) i det nye projekt.
   - Opret en ny OAuth 2.0 Client ID (Web application) i det nye
     projekt, fx navngivet "Boholts Familieplatform — Main".
   - Autoriseret redirect-URI: `https://<main-domænet>/auth/google/callback`
     — den faktiske URL for produktionsmiljøet (se åbent spørgsmål
     nedenfor, jeg kender ikke denne værdi).
3. **Udfyld OAuth-samtykkeskærmen** i det nye projekt fuldt ud:
   appnavn, logo, support-e-mail, autoriseret domæne, link til
   `/privacy` og `/terms`.
4. **Skift samtykkeskærmens udgivelsesstatus** fra "Testing" til
   "Forbered til verificering" ("Publish app" → "Prepare for
   verification"). Calendar-scopes regnes typisk som "sensitive" —
   Google beder ofte om en kort demo-video, der viser præcis hvordan
   scopet bruges i appen. Kan tage fra dage til flere uger.
5. **Opret et NYT secret i Cloudflares Secrets Store** med den nye
   klients Client Secret, under et NYT navn (fx
   `google-client-secret-main`), i samme store
   (`2bc6325a385d4ca3bc555d66f5453a21`). Genbrug IKKE det eksisterende
   `google-client-secret`-navn — `beta` skal blive ved med at pege på
   det uændret.

---

## Det jeg selv kan gøre, når trin 1-5 er udført

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

Ingen kodeændring før Nicolaj har gennemført trin 1-5. Når secret og
Client ID er klar: `npx tsc -b`, `npm run build` grønne efter
`wrangler.jsonc`-opdateringen — ingen ny migration, ingen e2e-relevans
(rent driftskonfiguration).
