# 33_Sprint33_Siden_Sidst_Plan

> Status: Gennemført; synlig tom-tilstand til gennemgang

Version: 2.1

Project:
Boholts Family Platform

Last Updated:
2026-09-01

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et "Siden sidst du var her"-kort på forsiden: et kompakt teaser-felt der ved
tryk åbner en dialog med de vigtigste ting, familien har foretaget sig i
appen siden brugerens sidste besøg — nye, flyttede og aflyste aftaler,
fuldførte/nye opgaver, indkøb og nye familiemedlemmer. En "Vis alt"-handling
folder ud til en fuld, grupperet liste. UI'et er allerede gennemgået og
godkendt visuelt (skærmbilleder delt separat i chatten); denne plan dækker
den tekniske implementering.

**Version 2.0** retter to arkitekturproblemer fundet ved gennemgang af v1.0
mod den faktiske kode, inden noget blev bygget: forkert baseline-kilde og
manglende Google-konto-ejerskab i cron-jobbet. Se ændringerne under hver
relevant beslutning.

---

## Beslutninger

1. **Egen aktivitets-cursor, ikke `sessions`.** ~~v1.0 brugte brugerens
   næstnyeste `sessions`-række som baseline~~ — forkert: `createSession()`
   kaldes kun ved et reelt Google OAuth-login (`auth.ts`s
   `/google/callback`), ikke ved hver app-åbning, og sessionen lever 30
   dage uden fornyelse. En bruger, der åbner appen fire dage i træk uden at
   logge ud, ville stadig se "siden sidst" pege tilbage til login-dagen,
   ikke sidste besøg. Ny tabel `user_activity_cursors (user_id, family_id,
   last_seen_at)`, opdateret ved hvert besøg via et acknowledge-kald (se
   Teknisk tilgang). Global pr. bruger, ikke pr. enhed — kendt forenkling,
   se Kendte risici.
2. **Opgaver, indkøb og familie hentes direkte og live ved kald** — samme
   mønster som resten af forsidens data (Sprint 20). `tasks.created_at`/
   `done_at`, `shopping_list_items.created_at`/`checked_at`,
   `family_members` tilføjet siden cursoren. Ingen ny infrastruktur.
3. **Kalenderændringer kræver en logget historik, ikke et live-opslag.**
   Google's `syncToken` rapporterer nye, flyttede og slettede events siden
   sidste kald — men kun "siden sidste kald", ikke "siden en vilkårlig
   fortid". Mekanismen findes allerede klient-side (Sprint 25,
   `GoogleCalendarProvider.ts`); den udvides nu til at køre server-side og
   logge hver ændring løbende til en ny tabel, som aktivitets-endpointet
   blot læser fra.
4. **Cron'en bruger familiens ejers Google-forbindelse**, samme
   etablerede mønster som Sprint 26's delelink og Sprint 28's ugeresumé
   (begge slår `families.owner_user_id` op og bruger den forbindelse til
   at hente hele familiens kalenderdata, jf. `weeklySummary.ts`s
   `FamilyRow.ownerUserId`). `calendar_member_mappings` indeholder ikke
   noget bruger-id, og `getGoogleAccessToken(env, userId)` kræver et
   eksplicit et — cron'en har ingen indlogget bruger at læse det fra.
   Løsning: genbrug det samme opslag på `owner_user_id`, i stedet for at
   opfinde en ny ejerskabsmodel. Kendt begrænsning: hvis et familiemedlems
   kalender kun er tilgængelig via deres EGEN Google-forbindelse (ikke
   ejerens), synkes den ikke — samme begrænsning delelink/ugeresumé
   allerede har.
5. **Første synk og udløbet `syncToken` er bootstrap, ikke aktivitet.**
   Uden dette ville lanceringen (eller ethvert 410-Gone-fald) klassificere
   ALLE eksisterende kalenderaftaler som "nye" og oversvømme "Siden sidst"
   med falske hændelser. Se Teknisk tilgang for den eksplicitte algoritme.
6. **Genbruger det eksisterende 5-minutters cron-tick** (`*/5 * * * *`,
   Sprint 27's opgave-påmindelser) til kalender-synken, i stedet for at
   tilføje endnu et cron-tick. Beta-miljøet har i dag 3 af kontoens 5
   tilladte cron-triggers (Cloudflare Free-planens grænse — se Sprint 28's
   lektion, hvor produktionsmiljøet måtte sættes til `crons: []` for at
   holde sig under loftet). Et fjerde tick ville stadig være under
   grænsen, men kræver ingen ekstra trigger, når det 5-minutters tick, der
   allerede kører, er hyppigt nok til delta-kald.
7. **Regelbaseret, ikke AI-genereret.** I modsætning til Sprint 28's
   ugeresumé er dette en tælling + de seneste konkrete elementer, ikke et
   Workers AI-kald — skal svare hurtigt ved hvert besøg og har ingen risiko
   for at opfinde noget.
8. **Teaser-kort → dialog → fuld liste**, ikke alt på forsiden med det
   samme. Dialogens rækkefølge er prioriteret: ændringer der kræver et blik
   (flyttet/aflyst aftale) før rent nyt (nye aftaler, fuldførte opgaver,
   indkøb). Den fulde liste er grupperet pr. kategori og afkortet med
   "+N flere" ved lange perioder, i stedet for at vise alt råt.
9. **Funktionen er altid synlig, men dialogen åbnes kun ved aktivitet.**
   Praktisk beta-test viste, at et helt skjult kort fik funktionen til at
   ligne noget, der ikke fandtes. Første besøg viser derfor, at overblikket
   er klar, og tom aktivitet viser "Du er helt ajour". Når der er nyt,
   bliver kortet igen den klikbare teaser til dialogen.
10. **Kortets "set"-tilstand er selve cursoren, ikke en separat
    lokal tilstand.** ~~v1.0 foreslog `localStorage` nøglet på
    sessionens id~~ — ikke implementérbart: session-cookien er bevidst
    `httpOnly`, så frontend-koden kan aldrig læse dens id, og
    `SessionUser` (det serveren returnerer til klienten) indeholder kun
    brugerens id, ikke sessionens. Løsning: `GET`-kaldet returnerer et
    `asOf`-tidspunkt sammen med aktiviteten; når kortet lukkes (eller "Vis
    alt" er set færdig), sender frontend det samme `asOf` tilbage til et
    `POST /acknowledge`, som flytter cursoren frem til netop dét
    tidspunkt. Virker ens på tværs af telefon/tablet/desktop, uden noget
    enheds-lokalt at holde styr på.
11. **Familie-bredt, ikke personligt filtreret**, i denne første version —
    bevidst forenkling, se Kendte risici.
12. **90 dages retention på `calendar_activity_log`**, ryddet af det
    eksisterende daglige cleanup-cron (samme job som allerede rydder
    udløbne sessioner og gamle rate-limit-forsøg). Giver samtidig en
    naturlig øvre grænse for, hvor langt tilbage "Siden sidst" kan vise —
    ikke et akut behov ved appens nuværende skala, men rigtigt at beslutte
    nu frem for at lade tabellen vokse uindskrænket.

---

## Teknisk tilgang

- **Migration 0020** (`develop` har allerede 0018/0019 til
  ICS-kalenderabonnementer):
  - `user_activity_cursors (user_id TEXT NOT NULL REFERENCES users(id),
    family_id TEXT NOT NULL REFERENCES families(id), last_seen_at TEXT NOT
    NULL, PRIMARY KEY (user_id, family_id))`
  - `calendar_sync_state (google_calendar_id TEXT PRIMARY KEY, family_id
    TEXT NOT NULL, sync_token TEXT NOT NULL, updated_at TEXT NOT NULL)`
  - `calendar_event_snapshots (google_calendar_id TEXT NOT NULL, event_id
    TEXT NOT NULL, safe_title TEXT NOT NULL, is_private INTEGER NOT NULL
    DEFAULT 0, start TEXT NOT NULL, end TEXT NOT NULL, PRIMARY KEY
    (google_calendar_id, event_id))` — gemmer ALDRIG den rå Google-titel;
    `safe_title`/`is_private` kommer fra `getSafeGoogleEventDetails()` (se
    nedenfor), samme værdi som ville blive vist. Bruges til at afgøre om en
    opdatering var en reel flytning (ændret start/slut) eller blot en
    anden redigering.
  - `calendar_activity_log (id TEXT PRIMARY KEY, family_id TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('created','moved',
    'cancelled')), safe_title TEXT NOT NULL, old_start TEXT, new_start
    TEXT, source_updated_at TEXT, detected_at TEXT NOT NULL)`, indeks på
    `(family_id, detected_at)`. `source_updated_at` er Google's eget
    opdateringstidspunkt for eventet (hvis leveret); `detected_at` er
    hvornår vores cron faktisk registrerede ændringen — "Siden sidst"
    filtrerer på `detected_at`, `source_updated_at` er kun til
    fejlsøgning.
  - `schemaCheck.ts`s `expectedTables`/`expectedColumns` opdateres samtidig
    (samme disciplin som alle migrationer siden Sprint 29's driftsincident).
- **`server/lib/calendarActivitySync.ts`**: ny `syncCalendarActivity(env)`,
  kaldt fra det eksisterende `*/5 * * * *`-tick i `index.ts`s `scheduled()`
  (beslutning 6):
  1. For hver kalender i `calendar_member_mappings`, gruppér pr. familie og
     hent adgangstoken via familiens `owner_user_id` (beslutning 4).
  2. **Intet gemt `syncToken` for kalenderen ⇒ bootstrap-tilstand**
     (beslutning 5): hent alle events i tidsvinduet, skriv
     `calendar_event_snapshots` for hver, gem `nextSyncToken`. Skriv
     **ingen** rækker til `calendar_activity_log` i denne omgang.
  3. **Gemt `syncToken` findes ⇒ delta-tilstand**: hent delta via
     `syncToken`. For hvert ændret event: sammenlign mod
     `calendar_event_snapshots` — ukendt id ⇒ `created`; kendt id med
     ændret start/slut ⇒ `moved`; `status: "cancelled"` ⇒ `cancelled`.
     Opdatér/slet snapshottet, og skriv én række til
     `calendar_activity_log` pr. reel ændring.
  4. Titel/detaljer i BÅDE snapshot og aktivitetslog køres altid igennem
     server-sidens `getSafeGoogleEventDetails()`
     (`server/lib/googleCalendarPrivacy.ts`, allerede brugt af
     `googleCalendarAggregation.ts`) — ikke den frontend-only
     `redactCalendarEventForViewer`. Den rå Google-titel forlader aldrig
     kalenderintegrationslaget.
  5. **410 Gone (udløbet token)**: samme som bootstrap (trin 2) — ryd
     `calendar_sync_state`, genopbyg `calendar_event_snapshots` fra bunden,
     gem nyt `syncToken`, skriv INGEN aktivitetslog-rækker for denne
     resynk. Et lille vindue af historiske ændringer kan gå tabt (accepteret,
     se Kendte risici) — langt at foretrække frem for falske
     "ny aftale"-hændelser for hele kalenderen.
- **`GET /api/families/:id/activity/since-last-visit`**:
  1. Slå brugerens cursor op i `user_activity_cursors` for familien. Ingen
     cursor ⇒ tomt svar (kortet viser første-besøgs-tilstand) — og cursoren oprettes med
     `last_seen_at = nu`, så første besøg ikke senere fejlagtigt viser alt
     historik som "nyt".
  2. Slå op i `tasks`, `shopping_list_items`, `family_members` (nyere end
     cursoren) og `calendar_activity_log` (`family_id`, `detected_at` >
     cursoren).
  3. Returnér én prioriteret liste (kræver-blik før nyt, jf. beslutning 8)
     + kategori-optalte totaler til "Vis alt", samt et `asOf`-tidspunkt
     (tidspunktet forespørgslen faktisk kørte).
  4. **Ingen aktivitet fundet** ⇒ ryk cursoren frem til `asOf` med det
     samme (intet at kvittere for).
  5. **Aktivitet fundet** ⇒ cursoren rykkes IKKE endnu — det gør kun et
     efterfølgende `acknowledge`-kald.
- **`POST /api/families/:id/activity/acknowledge`**: body `{ asOf }` —
  samme værdi klienten fik fra sit seneste `GET`-kald. Sætter
  `user_activity_cursors.last_seen_at = asOf`, men kun hvis den indsendte
  `asOf` er nyere end den nuværende cursor (idempotent, beskytter mod at en
  forsinket/gentaget kvittering utilsigtet springer over aktivitet, klienten
  reelt aldrig nåede at vise).
- **Frontend**: nyt `src/features/activity`-modul —
  - `ActivityTeaserCard` (kompakt kort på `HomePage.tsx`, samme
    "hentes async, ingen blokerende spinner"-princip som
    `WeeklySummaryCard`)
  - `ActivitySummaryDialog` (de vigtigste, prioriteret)
  - `ActivityFullListDialog` (grupperet, afkortet fuld liste)
  - én hook til datakaldet, delt af alle tre — kalder `acknowledge` med
    det modtagne `asOf`, når kortet lukkes eller "Vis alt" er gennemset.
    Intet enheds-lokalt at gemme (beslutning 10).

---

## Rækkefølge

1. ~~Migration 0020 (fire tabeller) + `schemaCheck.ts` opdateret.~~ ✅
   **Gennemført.**
2. ~~`server/lib/calendarActivitySync.ts` + tests: bootstrap- vs.
   delta-tilstand, `created`/`moved`/`cancelled`-klassificering,
   410-håndtering (genopbygger snapshot uden falske aktivitetsrækker),
   `getSafeGoogleEventDetails()`-redaction i både snapshot og log.~~ ✅
   **Gennemført**: 8 tests.
3. ~~`calendarActivitySync.ts` koblet ind i `index.ts`s eksisterende
   `*/5 * * * *`-cron-gren, grupperet pr. familie via `owner_user_id`
   (ingen ændring i `wrangler.jsonc`, jf. beslutning 6).~~ ✅
   **Gennemført.**
4. ~~`GET /activity/since-last-visit` + `POST /activity/acknowledge` +
   tests: ingen-cursor-tilfælde (opretter cursor, viser intet), tom
   aktivitet (cursor rykker automatisk), fundet aktivitet (cursor rykker
   først ved acknowledge), idempotent acknowledge.~~ ✅ **Gennemført**:
   8 tests.
5. ~~Frontend: teaser-kort (`ActivityCard`) + `ActivitySummaryDialog` +
   `ActivityFullListDialog`, indsat i `HomePage.tsx` mellem hilsenen og
   den eksisterende to-kolonne-grid.~~ ✅ **Gennemført**, inkl. en synlig
   første-besøgs-/ajour-tilstand og en ren
   `buildActivityRows()`-funktion (6 tests) der bygger den prioriterede
   rækkefølge, delt af begge dialoger.
6. ~~Retention: udvid det eksisterende daglige cleanup-cron til at rydde
   `calendar_activity_log` ældre end 90 dage + test.~~ ✅ **Gennemført**
   som del af trin 2/3 (`cleanupOldCalendarActivity`).
7. [ ] Manuel test på beta (kræver et rigtigt cron-tick + reel
   kalenderaktivitet for at se en ægte "siden sidst"-periode) — Nicolaj
   bekræfter ved lejlighed, samme mønster som tidligere sprints.
8. ~~Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`).~~ ✅
   **Gennemført**: 65 testfiler, 612 tests, ren lint/build. → commit →
   push → verificér grøn CI + begge Workers Builds → merge.

---

## Kendte risici

1. **Flere enheder pr. bruger.** Cursoren er global pr. bruger, ikke pr.
   enhed (beslutning 1). Bekræfter man kortet på telefonen, er det også
   bekræftet på tabletten — bevidst valgt forenkling, ikke en fejl:
   alternativet (pr.-enhed-cursorer) ville kræve enheds-identitet, appen
   slet ikke har i dag.
2. **Synk-blind vinkel ved udløbet `syncToken` eller første bootstrap.**
   Et 410-svar eller den allerførste synk for en kalender genopbygger
   snapshottet uden at logge historik for det, der lå forud (beslutning
   5) — et lille vindue af reelle ændringer kan derfor være usynlige i
   "Siden sidst", til fordel for at undgå falske "ny aftale"-hændelser.
   Samme accepterede begrænsning som enhver kalender-synk-klient.
3. **Familie-bredt, ikke personligt filtreret** (beslutning 11). I store
   familier med meget aktivitet kan overblikket blive støjende — værd at
   revidere, hvis det viser sig i praksis.
4. **Kalenderen kræver, at familiens EJER har en aktiv Google-forbindelse**
   (beslutning 4) — samme begrænsning som delelink (Sprint 26) og
   ugeresumé (Sprint 28) allerede har. Et familiemedlems kalender, der kun
   er tilgængelig via deres EGEN (ikke ejerens) Google-forbindelse, synkes
   ikke.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
