# 48_Sprint48_Login_Microsoft_Apple_Kalenderforbindelser_Plan

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-13

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Idé-/planlægningsstadie — intet af nedenstående er påbegyndt endnu.

---

## Formål

Udvide login, så et familiemedlem, der kun har en Microsoft-/Outlook-konto,
kan komme ind i appen på lige vilkår med Google — i dag er "Sign in with
Google" den ENESTE login-metode (`users`-tabellen er nøglet på
`google_sub`, ingen anden login-rute findes), så et familiemedlem uden
Google slet ikke kan logge ind, heller ikke for at acceptere en invitation.

Samtidig ensrettes selve kalenderforbindelserne (Google/Microsoft/iCloud),
så de alle følger samme mønster: forbind konto → vælg hvilke kalendere
der skal hentes — uden at spørge om familiemedlem-tilknytning i selve
forbindelsen. Den tilknytning sker i stedet ét sted: under redigering af
det enkelte familiemedlem, som Google allerede gør i dag.

Beslutninger truffet undervejs i samtalen med Nicolaj (2026-09-13):

- Login-skærmen bygges som mockuppen med tre knapper: Google, Microsoft,
  Apple.
- **Apple-knappen er kun visuel for nu** — "kommer senere". Ingen
  OAuth-integration, indtil Nicolaj selv beslutter at tilmelde sig Apple
  Developer Program ($99/år, samme blokering som blev udskudt i
  `46_iOS_AppStore_Plan.md`s Fase 2).
- **Google og Microsoft bygges nu**, som rigtige login-metoder.

---

## Vigtigt fund: den eksisterende Outlook-KALENDER-integration kan ikke genbruges til login

`outlookCalendarConfig.ts` har `isTemporarilyDisabled = true` — hele
Outlook-kalenderfunktionen er slået fra, fordi den eksisterende
Azure-app-registrering ligger under **P+P Arkitekters Entra-tenant**
(Nicolajs arbejdsplads), som kræver admin-samtykke for nye apps
(`AADSTS65004`) — Nicolaj er ikke selv administrator dér, og godkendelsen
afventer stadig deres IT-afdeling.

Den app-registrering kan derfor **ikke** bruges til login: login skal
virke for ethvert familiemedlems Microsoft-konto (personlig
Outlook.com/Hotmail, ikke kun arbejds-/skolekonti under ét bestemt
firma-tenant).

**God nyhed:** dette er ikke samme slags blokering som kalender-sagen.
En ny app-registrering til login kan oprettes af Nicolaj selv, under sin
egen private Microsoft-/Azure-konto (gratis, ingen betaling, ingen
IT-godkendelse fra nogen andens organisation) — vælges som "Accounts in
any organizational directory and personal Microsoft accounts" ved
oprettelsen. Det er den samme slags trin, han allerede har været igennem
med Google Cloud Console.

**Anbefaling (ikke endeligt besluttet):** opret kun ÉN ny, personlig
Azure-app-registrering, brugt til BÅDE login (server-side OAuth) OG,
senere, en gentilslået Outlook-kalenderfunktion (samme app kan sagtens
have flere redirect-URI'er og scopes for hhv. login og kalender) — i
stedet for at vente på P+P's IT-afdeling. Kalender-delen af dette er
udenfor denne plans omfang og kræver sin egen beslutning fra Nicolaj.

---

## Omfang

### Del A — Microsoft-login (server-side OAuth, mirror af Google)

- Ny personlig Azure-app-registrering (Nicolaj opretter selv).
- Nye ruter i `server/routes/auth.ts`: `/microsoft/begin` og
  `/microsoft/callback` — samme mønster som `/google/begin`/`/google/callback`
  (authorization code + PKCE, state-cookie), scopes `openid profile email`
  (bevidst IKKE `Calendars.*` — login er adskilt fra
  kalenderintegrationen, som i forvejen er sin egen, separate
  MSAL-browser-baserede funktion).
- `users`-tabellen: ny nullable kolonne `microsoft_sub`, samme mønster som
  `google_sub` — én bruger-række kan i praksis kun have ét udbyder-id
  udfyldt (den udbyder, personen først loggede ind med).
- Nye hemmeligheder i Secrets Store (beta + main):
  `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.
- `LoginPage.tsx`: erstat den nuværende ene "Log ind med Google"-knap med
  de tre knapper fra mockuppen (samme visuelle mønster: Google og
  Microsoft er funktionelle, Apple er en deaktiveret knap med en kort
  "kommer senere"-forklaring).

### Del B — Apple-knap (kun visuel)

- Samme knap som i mockuppen, men uden nogen OAuth-integration bagved —
  enten deaktiveret med en kort forklaring ved klik, eller markeret
  "kommer senere" direkte på knappen.
- Afhænger ikke af, at Nicolaj beslutter sig for Apple Developer
  Program endnu.

### Del C — Kalenderforbindelser ensrettes (Google / Microsoft / iCloud)

Mål: samme mønster for alle tre — "Forbind konto" + "Vælg kalendere",
**aldrig** en familiemedlem-vælger i selve forbindelsen.

- **Google** følger allerede dette mønster (ejerskab via
  `calendar_member_mappings`, redigeres under "Rediger familiemedlem").
- **Microsoft/Outlook-kalenderen** (når den engang genaktiveres) følger
  samme mønster som Google allerede i dag — ingen ændring nødvendig her.
- **iCloud skal ændres:**
  - Fjern "Tildel familiemedlem"-feltet fra `IcloudConnectionsPanel`s
    tilføj-formular (Sprint 47 byggede dette bevidst anderledes end
    Google — det ændrer vi nu, efter Nicolajs ønske om ensretning).
  - iCloud-kalendere skal i stedet indgå i den samme
    `calendar_member_mappings`-mekanisme som Google/Outlook, så de
    dukker op i "Rediger familiemedlem"s "Kalender"-dropdown
    (`listAllMappableCalendars()` i `calendarProviderFactory.ts`
    udvides til også at liste iCloud-kalendere).
  - `IcloudCalendarProvider.getCalendars()`/`getEvents()` skal læse
    ejerskab fra `calendar_member_mappings` (nøglet på iCloud-kalenderens
    rå CalDAV-URL) i stedet for forbindelsens egen `family_member_id`.
  - `family_member_id`-kolonnen på `icloud_calendar_connections` bliver
    overflødig for ejerskab — kan blive stående ubrugt for nu (ikke
    kritisk at fjerne den i denne omgang).
- **Delt kalender (ICS) er IKKE del af denne ensretning** — den er
  strukturelt anderledes (et link, ikke en konto man logger ind på) og
  beholder sin egen medlem-tildeling direkte i selve abonnementet, som i
  dag.

---

## Ikke besluttet endnu

- Skal Outlook-KALENDER-integrationen forblive slået fra
  (`isTemporarilyDisabled`), indtil P+P-tenant-blokeringen løses af deres
  IT-afdeling, eller skal Nicolaj oprette en ny, personlig Azure-app til
  kalenderdelen (evt. samme app som login-delen, se anbefalingen ovenfor)?
  Udenfor denne plans omfang — kræver en selvstændig beslutning.
- Præcis visning af "kommer senere" for Apple-knappen (deaktiveret med
  forklaring ved klik, vs. et synligt mærke direkte på knappen).

---

## Test plan

Samme mønster som tidligere sprints i dette projekt:

- [ ] Lokal validering (lint, build/typecheck, worker:types:check,
      testsuite) før hver PR.
- [ ] CI grønt, deploy-beta bekræftet sund (health-check + ny migration
      for `microsoft_sub`).
- [ ] Manuel afprøvning af Microsoft-login på Beta med en rigtig
      personlig Microsoft-konto.
- [ ] Deploy-production bekræftet sund, efter Beta er verificeret.
