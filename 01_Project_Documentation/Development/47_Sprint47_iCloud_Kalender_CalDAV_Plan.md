# 47_Sprint47_iCloud_Kalender_CalDAV_Plan

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
**Implementeret og merget til `main`** (PR #225/#226, commits `1198a0c`,
`f487086`, `fa51c46`, `dd6b34f`). Denne statuslinje stod fejlagtigt som
"Idé-/planlægningsstadie" indtil 2026-09-19 (Sprint 49-oprydning), selvom
funktionen var færdigbygget — se
`49_Sprint49_Hjemmecentralen_Launch_Prep_Plan.md`, afsnit A5.

---

## Formål

Gøre det muligt at koble en iCloud-/Apple-kalender op på familieappen,
på samme måde som Google i dag (server-side, ingen native app, intet
Apple Developer-medlemskab nødvendigt) — se `46_iOS_AppStore_Plan.md`
for den separate, native iOS-app-plan, som denne funktion IKKE
afhænger af.

Vigtig afklaring, fundet undervejs i samtalen med Nicolaj: "Apple
Kalender-integration" er blevet brugt om to helt forskellige ting.
Denne plan handler om nummer 2:

1. **EventKit** (native, kræver Xcode/iOS-app) — dækkes af
   `46_iOS_AppStore_Plan.md`, Fase 1.
2. **CalDAV mod iCloud** (ren server-til-server-protokol, ingen native
   kode) — **dette dokument**. iCloud understøtter den åbne
   CalDAV-standard (samme protokol-familie som fx Thunderbird eller
   andre tredjeparts-kalenderklienter allerede bruger til at synke med
   iCloud, uden at være en Apple-godkendt app).

---

## Nuværende opsætning (relevant for denne plan)

Appen har i dag to kalender-kilde-mønstre, som denne funktion skal
placere sig imellem:

- **Google Calendar** (`googleConnection.ts`, `calendar_member_mappings`):
  OAuth, server-ejet token, læs OG skriv, cron-drevet aktivitetssynk
  hvert 5. minut (`calendarActivitySync.ts`).
- **ICS-abonnementer** (`ics_calendar_subscriptions`,
  `server/lib/icsCalendar.ts`, `server/routes/familyRoutes/icsSubscriptions.ts`):
  bruger-angivet URL (fx Outlooks "hemmelige iCal-adresse"),
  **skrivebeskyttet**, ingen login til kilden — kun selve linket.
  Bruger `ical.js` til parsing, med SSRF-hærdet hentning (URL'en er
  bruger-styret, så vilkårlige hosts skal kunne blokeres).

En iCloud CalDAV-integration ligner Google mest (rigtig konto-adgang,
læs OG skriv-mulighed), men autentificerer anderledes (se nedenfor).

---

## Teknisk tilgang: CalDAV mod iCloud

- **Adgang**: ikke OAuth — brugeren genererer en **app-specifik
  adgangskode** på sin egen Apple-konto (`appleid.apple.com` →
  "Sign-In and Security" → "App-Specific Passwords"). Denne kode
  (sammen med brugerens Apple-ID/e-mail) autentificerer mod
  `https://caldav.icloud.com` via HTTP Basic Auth.
- **Kryptering**: adgangskoden skal krypteres i D1, samme mønster som
  Googles refresh-token (`server/lib/tokenEncryption.ts`) — ikke gemt i
  klartekst.
- **Protokol-forløb** (WebDAV/CalDAV, ikke en almindelig REST-API):
  1. `PROPFIND` mod principal-URL'en for at finde brugerens
     "calendar home set"
  2. `PROPFIND` på calendar-home for at liste brugerens kalendere
     (hver med et `ctag` — samme idé som Googles `syncToken`: ændrer
     ctag sig ikke, er der ingen nye ændringer)
  3. `REPORT` (calendar-query) for at hente hændelser i et tidsvindue —
     svaret indeholder iCalendar-data (VEVENT), som kan parses med
     samme `ical.js`-bibliotek, appen allerede bruger til ICS
  4. **Skrivning** (nyt for denne integration, findes ikke i
     ICS-sporet): `PUT` med et iCalendar-dokument opretter/opdaterer en
     hændelse; `DELETE` fjerner den — hver ressource har et `ETag` til
     at undgå at overskrive en samtidig ændring
- **Ingen SSRF-bekymring** som ved ICS: URL'en er fast
  (`caldav.icloud.com`), ikke bruger-angivet.

---

## Datamodel (forslag — ikke endeligt)

Ny tabel, adskilt fra både `google_connections` og
`ics_calendar_subscriptions` (autentificering og synk-tilstand er for
forskellige til at genbruge nogen af dem direkte):

```
CREATE TABLE icloud_calendar_connections (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  apple_id_email TEXT NOT NULL,
  encrypted_app_specific_password TEXT NOT NULL,
  family_member_id TEXT REFERENCES family_members(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE icloud_calendar_sync_state (
  connection_id TEXT NOT NULL REFERENCES icloud_calendar_connections(id),
  caldav_calendar_url TEXT NOT NULL,
  ctag TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (connection_id, caldav_calendar_url)
);
```

**Besluttet (Nicolaj, 2026-09-12)**: flere familiemedlemmer skal hver
kunne forbinde deres EGEN iCloud-konto — ikke kun én ejer-forbindelse
pr. familie, som Googles nuværende model (`eventReminders.ts`/
`weeklySummary.ts` bruger udelukkende `family.ownerUserId`s
Google-forbindelse). `family_member_id` ovenfor er derfor ikke
valgfri i praksis, men reelt hvordan hver forbindelse knyttes til det
familiemedlem, der ejer den — samme mønster som
`ics_calendar_subscriptions` allerede bruger, snarere end Googles
enkelt-ejer-model.

---

## Sync-mekanisme — lærdom fra Google-token-hændelsen (2026-09-12)

**Vigtigt**: se `PR #219` ("fix: cache Google-adgangstoken") for en
frisk, reel hændelse, hvor `getGoogleAccessToken()` ikke cachede noget
og udløste 100.000+ D1-skrivninger på én dag. CalDAV-integrationen
bruger en statisk adgangskode (intet token, der udløber hver time), så
den SPECIFIKKE fejl kan ikke gentage sig her — men det generelle
princip står ved magt: skriv kun til D1, når noget faktisk har ændret
sig (sammenlign `ctag` FØR en dyr `REPORT`-forespørgsel, ligesom
Google-sporet allerede sammenligner `sync_token`), og undgå at gøre
mere arbejde end nødvendigt ved hvert cron-tick.

Foreslået: genbrug det eksisterende 5-minutters cron-tick
(`syncCalendarActivity`-mønsteret i `index.ts`), men med et
`ctag`-tjek FØRST, så et uændret kalender kun koster ét let
`PROPFIND`-kald, ikke en fuld `REPORT`.

---

## Skrivning: samme niveau som Google

**Besluttet (Nicolaj, 2026-09-12)**: fuldt Google-niveau fra start —
læs, skriv, redigér og slet, ikke kun ICS-sporets skrivebeskyttede
model. Det betyder:

- ETag-håndtering ved skrivning er en del af selve v1, ikke en senere
  udvidelse — undgår at overskrive en ændring foretaget fra en anden
  enhed/app i mellemtiden.
- En beslutning skal træffes, når arbejdet startes, om hvordan appens
  egne UI-flows (opret/redigér aftale) vælger, hvilken kalender-kilde
  en ny aftale skal skrives til, når familien har både Google og
  iCloud forbundet.

---

## Besluttet (Nicolaj, 2026-09-12)

- Flere familiemedlemmer skal hver kunne forbinde deres egen iCloud-konto.
- Fuldt Google-niveau: læs, skriv, redigér og slet — ikke kun læsning.

## Ikke besluttet endnu

- Hvordan appens opret/redigér-flows vælger målkalender, når en familie
  har både Google og iCloud forbundet (se "Skrivning" ovenfor).
- Skal denne funktion udvikles og testes på `beta` som normalt, uden
  relation til `46_iOS_AppStore_Plan.md`s faser?
