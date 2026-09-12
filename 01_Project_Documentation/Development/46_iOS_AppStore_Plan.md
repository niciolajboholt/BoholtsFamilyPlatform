# 46_iOS_AppStore_Plan

Version: 1.1

Project:
Boholts Family Platform

Last Updated:
2026-09-12

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Idé-/planlægningsstadie — intet af nedenstående er påbegyndt endnu.

---

## Formål

Gøre det muligt at teste en iOS-variant af appen via TestFlight/App
Store, med genbrug af den eksisterende React-kodebase (`05_App/web`)
frem for en fuld native genskrivning. Dette dokument lister, hvad der
konkret mangler ud over selve build-processen på en Mac (som Nicolaj
allerede er fortrolig med).

**Opdatering (2026-09-12, Nicolajs beslutning):** arbejdet deles i to
faser, så det kan påbegyndes uden at betale for et Apple Developer-
medlemskab endnu — se "Faseinddeling" nedenfor.

---

## Forudsætning at tjekke FØRST: Xcode kræver en tilstrækkeligt ny macOS-version

Xcode kører kun på macOS, og en given Xcode-version har et minimums-
krav til macOS (nyere Xcode → nyere iOS SDK → nyere macOS-krav). Er
Nicolajs Mac på en ældre macOS-version end det, den nyeste Xcode
kræver, er der to muligheder: opdatér macOS gratis (hvis hardwaren
understøtter den nyere version), eller — hvis hardwaren er for
gammel til at kunne opdateres — er en nyere/anden Mac nødvendig, før
Fase 1 kan gå i gang.

**Ikke afklaret endnu**: hvilken macOS-version Nicolajs Mac kører, og
om den er tilstrækkelig. Bør tjekkes (Apple-menu → "Om denne Mac") FØR
Fase 1 påbegyndes.

---

## Nuværende opsætning (relevant for denne plan)

- **Login**: udelukkende "Log ind med Google" (`server/routes/auth.ts`,
  `src/pages/LoginPage.tsx`) — ingen anden login-udbyder findes i dag.
- **Kalender-kilder**: Google Calendar (OAuth, `googleConnection.ts` +
  `calendar_member_mappings`), samt read-only ICS-abonnementer
  (`ics_calendar_subscriptions`, fx Outlook/Aula-kalenderlinks). Ingen
  Apple/iCloud-integration findes i dag.
- **Push-beskeder**: Web Push (VAPID), se `server/lib/pushNotifications.ts`,
  `server/routes/push.ts` og `push_subscriptions`-tabellen — bygget til
  browserens/service workerens egen push-API, ikke Apples.
- **Appen er i dag en PWA**: `manifest.webmanifest`, service worker
  (`src/sw.ts`, injectManifest-mode) — installerbar fra browseren, men
  ikke til stede i App Store.

---

## Faseinddeling: hvad kræver et betalt Apple Developer-medlemskab, og hvad ikke

En gratis Apple ID rækker til at bygge og køre appen på egen telefon
via Xcode (selvsignering, "personal team") — men appen udløber efter 7
dage og skal gensignes, og der er INGEN adgang til TestFlight, App
Store-indsendelse, eller et "Services ID" (kræves til den web-baserede
"Sign in with Apple"-opsætning, se Fase 2). Det betalte Apple Developer
Program (~800 kr/år) er først nødvendigt, når I rammer de grænser.

### Fase 1 — kan startes nu, uden at betale
1. **Native indpakning (Capacitor)** — se trin 2 nedenfor
2. **Apple Kalender (EventKit)** — se trin 4 nedenfor. Ren
   enheds-funktion (læs/skriv iOS' egen kalender), kræver hverken
   Apples servere eller distribution — kan bygges og testes direkte på
   Nicolajs egen telefon

### Fase 2 — kræver det betalte medlemskab (når I skal gå rigtigt live)
1. **"Sign in with Apple"** i den fulde udgave — web/server-flowet
   (Services ID) er en betalt funktion
2. **Native push (APNs)** — kræver et Apple Push-nøglepar fra
   udvikler-portalen
3. **TestFlight og App Store-indsendelse**

---

## Blokerende punkt (gælder Fase 2): "Sign in with Apple" (Apple-retningslinje 4.8)

Apples App Review-retningslinjer kræver, at en app, der tilbyder login
via en tredjeparts-/social udbyder (her: Google), **også** tilbyder
"Sign in with Apple" som et ligeværdigt alternativ. Uden det er der
reel risiko for afvisning i review. Dette er ikke en blokering for
Fase 1 (I distribuerer ikke endnu), men skal løses, før App Store-
indsendelse.

Kræver:
- Ny kolonne (fx `apple_sub`) på `users`, parallelt med det
  eksisterende `google_sub` (se migration `0002_auth.sql`)
- Ny server-side verifikation af Apples identity token (JWT, signeret
  af Apple — en anden model end Googles authorization-code-flow, se
  `server/lib/googleOAuth.ts` for det nuværende mønster)
- Ny knap på `LoginPage.tsx` ved siden af den eksisterende
- **Åbent spørgsmål**: skal en bruger kunne linke Apple- og
  Google-login til samme konto (fx hvis samme person bruger Google på
  `beta` i browseren, men Apple i iOS-appen)? Skal afklares med
  Nicolaj/Christine, før implementering — påvirker om `apple_sub` er
  et nyt, uafhængigt `users`-login eller en kobling til en
  eksisterende bruger.

---

## Trin (foreslået rækkefølge — Fase 1/2 markeret)

### 1. "Sign in with Apple" — Fase 2
Blokerende for App Store-godkendelse, uafhængig af resten — kan i
princippet bygges og testes i browseren på `beta`, før nogen native
indpakning rører ved den.

### 2. Native indpakning (Capacitor) — Fase 1
- Sæt [Capacitor](https://capacitorjs.com/) op omkring den
  eksisterende Vite/React-build (`05_App/web`) — genbruger frontend
  1:1, ingen omskrivning af selve appen
- Konfigurér iOS-projektet (app-ikon, launch screen, bundle-id)
- Mål: en kørende, indlogget app i iOS-simulatoren/på egen telefon —
  login sker stadig via Google i denne fase, da Sign in with Apple er
  Fase 2

### 3. Native push (APNs) — Fase 2
- Web Push (VAPID) virker ikke i en native iOS-app — skal
  suppleres/erstattes af Apples eget push-system for iOS-brugere
- Capacitors Push Notifications-plugin håndterer klient-siden; server
  skal kunne sende til APNs-device-tokens ved siden af/i stedet for de
  nuværende `push_subscriptions`-rækker
- Kræver et Apple Push-nøglepar (oprettes i Apple Developer-portalen)

### 4. Apple Kalender (EventKit) — Fase 1
- Ny native plugin (Swift) til at bede om kalender-tilladelse og
  læse/skrive iOS' egen kalender (inkl. iCloud-kalendere) via
  Apples EventKit-framework — kan ikke laves fra ren web/JS-kode
- Skal indpasses i samme mønster som eksisterende kalender-kilder:
  Apple-kalendere bliver reelt en TREDJE kilde ved siden af Google
  (`calendar_member_mappings`) og ICS-abonnementer
  (`ics_calendar_subscriptions`) — nøjagtig datamodel afklares, når
  arbejdet startes
- Vigtigt for både reel værdi (mange familier bruger iCloud, ikke
  Google) og for at bestå Apples "Minimum Functionality"-krav
  (retningslinje 4.2) — en ren indpakning af en hjemmeside uden nogen
  nativ integration risikerer afvisning

### 5. Klar til App Store — Fase 2
- Privacy-oplysninger ("nutrition label" — hvilke data appen
  indsamler, jf. `/privacy`-sidens indhold)
- Skærmbilleder, app-beskrivelse, ikon i fuld opløsning
- TestFlight til intern familietest, derefter indsendelse til review

---

## Ikke besluttet endnu

- Nicolajs Macs macOS-version — se "Forudsætning at tjekke FØRST" ovenfor.
- Skal iOS-varianten pege på `beta` eller `main` (production)? Givet
  `main` er den, der går gennem Googles verificering til bredere brug
  (se `44_Google_OAuth_Adskillelse_Main_Beta_Plan.md`), er `main`
  formentlig det rigtige mål — men ikke eksplicit bekræftet.
- Skal Apple-login give adgang til en EKSISTERENDE familie (invite-kode,
  samme mønster som i dag), eller er der brug for ændringer i
  familie-tilslutningsflowet for en ny bruger, der ankommer via iOS?
- Omfang af "test" — er målet en rigtig App Store-udgivelse til
  offentligheden, eller kun TestFlight til familien selv i første
  omgang? Påvirker hvor meget af trin 5 der reelt skal laves nu.
