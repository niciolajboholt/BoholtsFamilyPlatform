# 46_iOS_AppStore_Plan

Version: 1.0

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

## Blokerende punkt: "Sign in with Apple" (Apple-retningslinje 4.8)

Apples App Review-retningslinjer kræver, at en app, der tilbyder login
via en tredjeparts-/social udbyder (her: Google), **også** tilbyder
"Sign in with Apple" som et ligeværdigt alternativ. Uden det er der
reel risiko for afvisning i review — dette bør derfor løses FØR resten
af arbejdet, ikke som en eftertanke.

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

## Trin (foreslået rækkefølge)

### 1. "Sign in with Apple" (se ovenfor)
Blokerende for App Store-godkendelse, uafhængig af resten — kan i
princippet bygges og testes i browseren på `beta`, før nogen native
indpakning rører ved den.

### 2. Native indpakning (Capacitor)
- Sæt [Capacitor](https://capacitorjs.com/) op omkring den
  eksisterende Vite/React-build (`05_App/web`) — genbruger frontend
  1:1, ingen omskrivning af selve appen
- Konfigurér iOS-projektet (app-ikon, launch screen, bundle-id)
- Kræver en Apple Developer-konto (til signering og TestFlight)
- Mål: en kørende, indlogget app i iOS-simulatoren

### 3. Native push (APNs)
- Web Push (VAPID) virker ikke i en native iOS-app — skal
  suppleres/erstattes af Apples eget push-system for iOS-brugere
- Capacitors Push Notifications-plugin håndterer klient-siden; server
  skal kunne sende til APNs-device-tokens ved siden af/i stedet for de
  nuværende `push_subscriptions`-rækker
- Kræver et Apple Push-nøglepar (oprettes i Apple Developer-portalen)

### 4. Apple Kalender (EventKit)
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

### 5. Klar til App Store
- Privacy-oplysninger ("nutrition label" — hvilke data appen
  indsamler, jf. `/privacy`-sidens indhold)
- Skærmbilleder, app-beskrivelse, ikon i fuld opløsning
- TestFlight til intern familietest, derefter indsendelse til review

---

## Ikke besluttet endnu

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
