# 24_Sprint24_Drift_Hygiejne_Plan

> Status: Afventer godkendelse

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-18

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et nyt, uafhængigt eksternt review (`af9e3c79-BoholtsFamilyPlatform_review.md`,
2026-08-18) er gennemgået. Det bekræfter at kernearkitekturen (Cloudflare
Worker + D1, ADR-017) er solid, men peger på et gennemgående mønster:
**dokumentation og drift er sakket bagud for det faktiske kodegrundlag**, og
et par mindre driftsrisici er aldrig lukket. Dette sprint er bevidst ikke en
featuresprint — det er oprydning, så platformen står på et ærligt og sikkert
fundament, før Sprint 25-28 bygger videre (kalender-sync, PWA-ikoner,
tidsbaserede påmindelser, AI-ugeresumé).

Sprint 24 er første del af en ny roadmap besluttet i chat (2026-08-18):

- **Sprint 24** (dette dokument): dokumentations- og drift-hygiejne.
- Sprint 25: `nextSyncToken`-inkrementel Google-sync + rigtigt PWA-ikonsæt.
- Sprint 26: kalender-konfliktdetektion + read-only delelink.
- Sprint 27: tidsbaserede rutine-/opgave-påmindelser (kræver Cron Trigger).
- Sprint 28: AI-ugeresumé til familien (Cloudflare Workers AI).
- Sprint 29+ (Family OS Fase 4 — madplan, budget, dokumenter): **udskudt**,
  besluttet i chat 2026-08-18 ("Vent til senere").

---

## Beslutninger

1. **README.md og CHANGELOG.md skrives om fra grunden.** Begge beskriver i
   dag en arkitektur der ikke længere findes:
   - `README.md` siger stadig "appen har endnu ingen backend eller
     refresh-token", at OAuth-tokenet "kun opbevares i browserhukommelsen",
     og at deployment sker til **Cloudflare Pages** med miljøvariabler sat i
     Pages-dashboardet. Det er alt sammen forladt siden ADR-017 (Sprint 20):
     platformen er en Cloudflare Worker + D1 med server-ejet Google-login,
     krypteret refresh token i D1, og deploy via Cloudflare Workers Builds
     (git-integration), ikke Pages.
   - `CHANGELOG.md` stopper ved "Version 1.1" (Sprint 19) og nævner intet om
     Sprint 20-23 (familier/roller, push, indkøbslister, opgaver/rutiner,
     AI-modul).
   - Begge opdateres til at afspejle den faktiske stak: React 19 + TypeScript
     + Vite (klient), Hono + D1 (server), Cloudflare Workers (ikke Pages),
     Web Push (VAPID), Cloudflare Workers AI. `README.md`'s
     lokal-udviklings- og deployment-afsnit rettes til at matche
     `05_App/web/wrangler.jsonc` (top-level = produktion, `env.beta` = beta),
     og `CHANGELOG.md` får et nyt afsnit pr. sprint (20-23) i samme stil som
     "Version 1.1".
2. **Bekræft `secrets_store_secrets`-navnene i produktion manuelt.**
   `wrangler.jsonc` linje 19-21 har en eksplicit kommentar: "Antager samme
   secret-navne som beta ... ret disse, hvis main's Secrets Store-bindinger
   reelt hedder noget andet." Dette er aldrig blevet bekræftet. Nicolaj slår
   op i Cloudflare-dashboardet (Workers & Pages → produktions-workeren →
   Settings → Secrets Store-bindinger) og bekræfter navn/`store_id` for
   `GOOGLE_CLIENT_SECRET` (og evt. andre). Rettes i `wrangler.jsonc` hvis de
   ikke matcher; ellers fjernes den usikre kommentar, og der noteres i stedet
   "bekræftet 2026-08-XX".
3. **Cron Trigger til periodisk session-oprydning.** `sessions`-tabellen
   ryddes i dag kun lejlighedsvist — `server/lib/session.ts` sletter en
   session, når den bruges og er udløbet (`DELETE FROM sessions WHERE id = ?`
   ved brug), men der er ingen oprydning af sessioner der aldrig bruges
   igen. Tabellen vokser derfor ubegrænset over tid. Tilføjes en
   `scheduled`-handler i `server/index.ts` (Cloudflare Cron Trigger, fx
   dagligt kl. 04:00) der køre `DELETE FROM sessions WHERE expires_at < ?`
   med nutidens tidspunkt. Dette er første brug af Cron Triggers i
   platformen — holdes bevidst minimalt (én tabel, ét formål), så det ikke
   bliver en forudsætning for Sprint 27's påmindelser, som er en separat,
   større beslutning.
4. **Simpel rate-limiting på invite-accept.** `POST
   /api/families/invites/:code/accept` (`server/routes/families.ts:171`)
   tager en 8-tegns invite-kode uden nogen begrænsning på antal forsøg —
   koden kan i praksis brute-forces. Der findes ingen eksisterende
   rate-limiting noget sted i kodebasen i dag. Tilføjes en simpel, IP- eller
   bruger-baseret grænse (fx via Cloudflare's indbyggede Rate Limiting på
   Worker-ruten, eller en lille tæller i D1/KV hvis Cloudflare Rate Limiting
   ikke er tilgængeligt på den nuværende plan) — konkret implementering
   afklares når vi når hertil i rækkefølgen, men princippet er: for mange
   forsøg mod samme kode/IP inden for et kort vindue afvises.
5. **Dependabot aktiveres.** Der er i dag ingen automatiseret afhængigheds-
   opdatering eller sårbarhedsscanning — kun `npm run lint`/`build`/`test` i
   CI. Tilføjes `.github/dependabot.yml` (npm-økosystem, `05_App/web`-mappe,
   ugentligt), så sårbare/forældede afhængigheder flages automatisk som PR'er
   i stedet for at blive opdaget manuelt.
6. **`10_Future_Roadmap.md` og `07_Product_Roadmap.md` opdateres.**
   `10_Future_Roadmap.md`s "Nuværende status" nævner stadig ikke Sprint 21-23
   og beskriver Sprint 20 som "i gang" (det er afsluttet og merget).
   `07_Product_Roadmap.md` (v0.1) er stadig den oprindelige, aldrig
   opdaterede skitse fra projektstart (Fase 1-4, ingen af Sprint 20-23's
   reelle indhold). Begge opdateres til at vise: hvad der reelt er leveret
   (Sprint 0-23), og den nye Sprint 24-28-roadmap besluttet i chat
   2026-08-18, med Fase 4/Family OS (madplan, budget, dokumenter) markeret
   som udskudt indtil videre.
7. **Ingen ny funktionalitet i dette sprint.** Formålet er hygiejne og
   ærlig dokumentation — ikke nye brugerflows. Hvis noget af ovenstående
   viser sig at kræve en arkitekturbeslutning af Sprint 20-størrelse (fx hvis
   Cloudflare Rate Limiting ikke er tilgængeligt og kræver en større D1/KV-
   løsning), stoppes og afklares det med Nicolaj i stedet for at
   overraskelses-udvide sprintet.

---

## Rækkefølge

1. Bekræft `secrets_store_secrets`-navne i Cloudflare-dashboardet (Nicolaj) —
   afklares først, da resten af sprintet ikke afhænger af det, men det er
   den eneste opgave der kræver et menneske i Cloudflare-dashboardet i
   stedet for kode.
2. Skriv `README.md` og `CHANGELOG.md` om.
3. Opdatér `10_Future_Roadmap.md` og `07_Product_Roadmap.md`.
4. Ret de tre statusdokumenter (`PROJECT_STATUS.md`,
   `00_Project_Control/Project_Status.md`, `00_Project_Control/TASKS.md`),
   som i dag fejlagtigt stadig siger "Sprint 23 er endnu ikke merget til
   main" — det blev merget (PR #34) umiddelbart efter de blev skrevet.
5. Cron Trigger til session-oprydning, med automatiseret test (fake tidsstempler,
   verificér at kun udløbne sessioner slettes).
6. Rate-limiting på invite-accept, med automatiseret test (for mange forsøg
   → afvist).
7. `.github/dependabot.yml`.
8. Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`) → commit → push →
   verificér grøn CI + begge Workers Builds → merge `develop` til `main`.

---

## Kendte risici

1. **Cloudflare Rate Limiting kan kræve en plan/feature vi ikke har
   bekræftet er tilgængelig** — undersøges som del af opgave 6; falder vi
   tilbage til en D1/KV-tæller i stedet, er det stadig inden for sprintets
   ramme, men tages op med Nicolaj hvis det ender med at kræve en ny
   binding/ressource der ikke allerede findes.
2. **Cron Triggers er ny infrastruktur for platformen** — første brug
   nogensinde. Holdes bevidst til præcis én ting (session-oprydning), så
   Sprint 27's langt større spørgsmål (tidsbaserede push-påmindelser) ikke
   utilsigtet forudsættes løst her.
3. **Dokumentationsopdateringen er stor i omfang** (README, CHANGELOG, to
   roadmap-dokumenter, tre statusdokumenter) men lav risiko — ingen
   kodeadfærd ændres, kun tekst.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
