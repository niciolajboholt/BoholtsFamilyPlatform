# 25_Sprint25_Kalendersync_PWA_Plan

> Status: Completed

Version: 1.1

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

Andet sprint i den nye roadmap efter det eksterne review (2026-08-18, se
Sprint 24). Adresserer to tidligere kendte, bevidst udskudte fund:

1. **F-05 (delvist)**: Google Calendar-hentning bruger i dag altid et fast
   tidsvindue (`timeMin`/`timeMax`, ca. ±1/2 år) og henter ALLE aftaler i
   det vindue på ny, hver gang siden indlæses eller opdateres — ingen
   inkrementel synk (`nextSyncToken`) er implementeret, selvom det blev
   identificeret allerede i den stabiliseringsmilepæl, der lukkede resten
   af F-05 (se `10_Future_Roadmap.md`).
2. Kun ét SVG-ikon (`favicon.svg`) bruges til alt: manifest, maskable-ikon
   og `apple-touch-icon` — intet rigtigt PNG-ikonsæt i de størrelser
   PWA-installation og iOS reelt forventer.

---

## Beslutninger

1. **Sync-token gemmes device-lokalt (localStorage), ikke i D1.** Det er en
   ren hente-optimering for netop denne enheds næste opdatering — samme
   kategori som de eksisterende lokale præferencer
   (`googleCalendarExclusionStorage.ts`, `calendarMemberMappingStorage.ts`s
   lokale cache), ikke familie-delt state. Hver enhed synker uafhængigt;
   det er allerede sådan appen fungerer i dag (ADR-011, single-device pr.
   sync).
2. **En ny, lille klient-cache af selve aftalerne indføres — nødvendigt,
   ikke valgfrit.** Inkrementel synk returnerer per definition kun
   *ændringer* siden sidste synk, ikke hele listen — uden en cache af
   sidste fulde resultat er der intet at anvende ændringerne på. I dag
   findes ingen event-cache overhovedet (Sprint 20 Fase 5 fjernede det
   daværende lokale aftale-lag helt, jf. ADR-011/012). Denne nye cache er
   bevidst en **forkastelig, rent lokal ydelsesoptimering** — ikke en
   genindførelse af det fjernede aftale-lag: den kan til enhver tid ryddes
   og genopbygges fra en fuld synk uden datatab, fordi Google Calendar
   forbliver eneste sandhedskilde. Gemmes i localStorage, nøglet på
   `calendarId`.
3. **Fald tilbage til dagens fulde synk i to tilfælde**: (a) intet
   syncToken cachet endnu (første load på enheden, eller efter cache
   ryddet), (b) Google svarer `410 Gone` (syncToken udløbet — sker typisk
   efter lang tids inaktivitet). Begge tilfælde er usynlige for brugeren,
   blot en anelse langsommere end en inkrementel synk.
4. **Kun Google, ikke Outlook.** Outlook-integrationen (MSAL) har sin egen,
   separate implementering (`OutlookCalendarApi.ts`) og er uden for dette
   sprints omfang.
5. **PWA-ikoner genereres som PNG i flere størrelser** (192×192, 512×512,
   plus en maskable-variant) fra det eksisterende `favicon.svg`, via en
   engangs-rasteriseringsscript — ikke en ny runtime-afhængighed i selve
   appen. Erstatter referencerne i `vite.config.ts`s manifest og
   `index.html`s `apple-touch-icon`.

---

## Teknisk tilgang

- `GoogleCalendarEventsResponse` (`googleCalendarTypes.ts`) udvides med
  `nextSyncToken?: string`. `GoogleCalendarApi.listEvents()` understøtter
  et `syncToken`-argument — når sat, sendes `syncToken` i stedet for
  `timeMin`/`timeMax`/`singleEvents`/`orderBy` (Googles API tillader ikke
  at blande syncToken med et tidsvindue).
- Ny `googleCalendarSyncCacheStorage.ts`: `getCachedCalendarState(calendarId)`
  / `setCachedCalendarState(calendarId, { events, syncToken })` /
  `clearCachedCalendarState(calendarId)`, samme stil som eksisterende
  storage-moduler.
- `GoogleCalendarProvider.getEvents()`: pr. kalender, hvis et syncToken er
  cachet, kald `listEvents(calendarId, { syncToken })`; flet svarets
  events ind i den cachede liste (opdatér match på id, tilføj nye, fjern
  events med `status === "cancelled"`); gem det nye `nextSyncToken`. Ved
  manglende cache eller 410 Gone: almindelig fuld synk (dagens adfærd) og
  gem det første `nextSyncToken`.
- PNG-ikonerne genereres én gang med et lille script (fx `cairosvg` via
  `pip3 install cairosvg`, samme mønster som `xlsx`-skillets
  `openpyxl`-installation i Sprint 22) og committes som statiske filer i
  `public/`.

---

## Rækkefølge

1. ~~Typer + `syncToken`-understøttelse i `GoogleCalendarApi.listEvents()`~~
   ✅ **Gennemført (2026-08-18)**: `GoogleCalendarEventsResponse.nextSyncToken`,
   `listEvents()` tager nu `{ range } | { syncToken }`, ny `fetchEventPages()`
   der bevarer `nextSyncToken` fra svarets sidste side.
2. ~~`googleCalendarSyncCacheStorage.ts` + automatiserede tests~~ ✅
   **Gennemført**: localStorage pr. `calendarId`, 6 tests.
3. ~~`GoogleCalendarProvider.getEvents()`: cache/delta-flet +
   fuld-synk-fallback~~ ✅ **Gennemført**: `fetchCalendarEvents()` +
   `mergeGoogleEventDelta()`, 6 tests (fuld synk, cache-brug, delta-flet,
   cancelled fjerner event, 410 → fuld synk, øvrige fejl kastes videre).
4. **Manuel test på beta/produktion — udestår**: kræver browserens
   netværksfane og er ikke noget en AI-agent kan udføre alene. Nicolaj kan
   bekræfte ved lejlighed at en gentaget kalenderopdatering sender
   `syncToken` og får et mindre svar end første load.
5. ~~PNG-ikonsæt genereret, koblet i `vite.config.ts` og `index.html`~~ ✅
   **Gennemført**: `icon-192.png`, `icon-512.png`,
   `icon-maskable-{192,512}.png`, `apple-touch-icon.png` (180×180) —
   rasteriseret fra `favicon.svg` via headless Chromium (allerede i
   miljøet), for at bevare SVG'ens filtre/blur, som simplere konvertere
   typisk ikke understøtter korrekt.
6. ~~Kvalitetskontrol → commit → push → merge~~ ✅ **Gennemført**: 272 tests
   (20 nye siden Sprint 24), lint/tsc/build grønne.

---

## Kendte risici

1. **Event-cache-laget er ny kompleksitet** i et område (kalenderdata) hvor
   en tidligere lignende cache-fejl (Sprint 16's Strict Mode-hang, se
   `10_Future_Roadmap.md`s Fase 0) allerede har vist at forhastet
   cache-/samtidigheds-logik er risikabelt. Skal testes grundigt for
   korrekt flet-logik, ikke kun happy path.
2. **Cache-inkonsistens på tværs af enheder er per design** (hver enhed
   har sin egen cache/syncToken) — hvis en anden enhed opretter en aftale,
   ser denne enhed den først ved sin egen næste synk. Dette er ikke en
   regression: det er allerede dagens adfærd, da der ikke findes
   realtidsopdatering af selve kalenderdata mellem enheder (kun en
   push-notifikation der opfordrer til at opdatere, jf. Sprint 21).
3. **PNG-ikongenereringen er et engangsscript**, ikke en del af den
   almindelige build — hvis `favicon.svg` ændres senere, skal ikonerne
   genereres igen manuelt. Accepteret for at undgå en ny build-tids-
   afhængighed for noget der sjældent ændrer sig.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
