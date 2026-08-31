# 31_Sprint31_Siden_Sidst_Plan

> Status: Afventer godkendelse

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-31

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et "Siden sidst du var her"-kort på forsiden: et kompakt teaser-felt der ved
tryk åbner en dialog med de vigtigste ting, familien har foretaget sig i
appen siden brugerens forrige login — nye, flyttede og aflyste aftaler,
fuldførte/nye opgaver, indkøb og nye familiemedlemmer. En "Vis alt"-handling
folder ud til en fuld, grupperet liste. UI'et er allerede gennemgået og
godkendt visuelt (skærmbilleder delt separat i chatten); denne plan dækker
den tekniske implementering.

---

## Beslutninger

1. **Login-baseline uden ny kolonne.** Hver login opretter allerede en række
   i `sessions` med `created_at`. "Sidst logget ind" er brugerens
   næstnyeste session, fundet før den nuværende oprettes. Global pr.
   bruger, ikke pr. enhed — kendt forenkling, se Kendte risici.
2. **Opgaver, indkøb og familie hentes direkte og live ved kald** — samme
   mønster som resten af forsidens data (Sprint 20). `tasks.created_at`/
   `done_at`, `shopping_list_items.created_at`/`checked_at`,
   `family_members` tilføjet siden baseline. Ingen ny infrastruktur.
3. **Kalenderændringer kræver en logget historik, ikke et live-opslag.**
   Google's `syncToken` rapporterer nye, flyttede og slettede events siden
   sidste kald — men kun "siden sidste kald", ikke "siden en vilkårlig
   fortid". Mekanismen findes allerede klient-side (Sprint 25,
   `GoogleCalendarProvider.ts`); den udvides nu til at køre server-side og
   logge hver ændring løbende til en ny tabel, som login-kaldet blot læser
   fra.
4. **Genbruger det eksisterende 5-minutters cron-tick** (`*/5 * * * *`,
   Sprint 27's opgave-påmindelser) til kalender-synken, i stedet for at
   tilføje endnu et cron-tick. Beta-miljøet har i dag 3 af kontoens 5
   tilladte cron-triggers (Cloudflare Free-planens grænse — se Sprint 28's
   lektion, hvor produktionsmiljøet måtte sættes til `crons: []` for at
   holde sig under loftet). Et fjerde tick ville stadig være under
   grænsen, men kræver ingen ekstra trigger, når det 5-minutters tick, der
   allerede kører, er hyppigt nok til delta-kald.
5. **Regelbaseret, ikke AI-genereret.** I modsætning til Sprint 28's
   ugeresumé er dette en tælling + de seneste konkrete elementer, ikke et
   Workers AI-kald — skal svare hurtigt ved hvert login og har ingen risiko
   for at opfinde noget.
6. **Teaser-kort → dialog → fuld liste**, ikke alt på forsiden med det
   samme. Dialogens rækkefølge er prioriteret: ændringer der kræver et blik
   (flyttet/aflyst aftale) før rent nyt (nye aftaler, fuldførte opgaver,
   indkøb). Den fulde liste er grupperet pr. kategori og afkortet med
   "+N flere" ved lange perioder, i stedet for at vise alt råt.
7. **Vises kun, når der reelt er noget at vise** — samme "ærlig
   tom-tilstand"-princip som resten af forsiden (Sprint 20/28). Ingen
   baseline (allerførste login) eller ingen ændringer siden sidst betyder
   intet kort, ikke et tomt kort.
8. **Husket luk-tilstand pr. login-session**, i `localStorage` nøglet på
   sessionens id — samme mønster som anden klient-cachet UI-tilstand (fx
   `googleCalendarExclusionStorage`). Lukkes kortet, dukker det ikke op
   igen før næste NYE login, ikke bare næste sideindlæsning.
9. **Familie-bredt, ikke personligt filtreret**, i denne første version —
   bevidst forenkling, se Kendte risici.

---

## Teknisk tilgang

- **Migration 0018** (tre nye tabeller):
  - `calendar_sync_state (google_calendar_id TEXT PRIMARY KEY, family_id
    TEXT NOT NULL, sync_token TEXT NOT NULL, updated_at TEXT NOT NULL)`
  - `calendar_event_snapshots (google_calendar_id TEXT NOT NULL, event_id
    TEXT NOT NULL, title TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT
    NULL, PRIMARY KEY (google_calendar_id, event_id))` — bruges til at
    afgøre om en opdatering var en reel flytning (ændret start/slut) eller
    blot en anden redigering.
  - `calendar_activity_log (id TEXT PRIMARY KEY, family_id TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK(change_type IN ('created','moved',
    'cancelled')), title TEXT NOT NULL, old_start TEXT, new_start TEXT,
    occurred_at TEXT NOT NULL)`, indeks på `(family_id, occurred_at)`.
  - `schemaCheck.ts`s `expectedTables`/`expectedColumns` opdateres samtidig
    (samme disciplin som alle migrationer siden Sprint 29's driftsincident).
- **`server/lib/calendarActivitySync.ts`**: ny `syncCalendarActivity(env)`,
  kaldt fra det eksisterende `*/5 * * * *`-tick i `index.ts`s `scheduled()`
  (beslutning 4):
  1. For hver kalender i `calendar_member_mappings`: hent delta via
     `syncToken` (nyt server-side kald mod Google, adskilt fra klientens
     egen `GoogleCalendarApi`) — fuld tidsvindue-synk hvis intet token er
     gemt for kalenderen endnu.
  2. Sammenlign hver ændret event mod `calendar_event_snapshots`: ukendt id
     ⇒ `created`; kendt id med ændret start/slut ⇒ `moved`; `status:
     "cancelled"` ⇒ `cancelled`. Opdatér eller slet snapshottet
     tilsvarende.
  3. Skriv ændringen til `calendar_activity_log`. Titel/detaljer køres
     igennem samme logik som `redactCalendarEventForViewer`, så private
     aftaler ikke lækkes i loggen.
  4. Håndterer 410 Gone (udløbet token): rydder `calendar_sync_state`,
     falder tilbage til fuld resynk, logger at et vindue kan være gået
     tabt (kendt begrænsning, se Kendte risici).
- **`GET /api/families/:id/activity/since-last-login`**:
  1. Find brugerens næstnyeste `sessions`-række som baseline. Ingen
     baseline ⇒ tomt svar (kort vises ikke).
  2. Slå op i `tasks`, `shopping_list_items`, `family_members` (nyere end
     baseline) og `calendar_activity_log` (`family_id`, `occurred_at` >
     baseline).
  3. Returnér én prioriteret liste (kræver-blik før nyt, jf. beslutning 6)
     + kategori-optalte totaler til "Vis alt".
- **Frontend**: nyt `src/features/activity`-modul —
  - `ActivityTeaserCard` (kompakt kort på `HomePage.tsx`, samme
    "hentes async, ingen blokerende spinner"-princip som
    `WeeklySummaryCard`)
  - `ActivitySummaryDialog` (de vigtigste, prioriteret)
  - `ActivityFullListDialog` (grupperet, afkortet fuld liste)
  - én hook til datakaldet, delt af alle tre.
  - Luk-tilstand i `localStorage`, egen lille modul svarende til
    `googleCalendarSyncCacheStorage.ts`s mønster (gem/hent/ryd).

---

## Rækkefølge

1. [ ] Migration 0018 (tre nye tabeller) + `schemaCheck.ts` opdateret.
2. [ ] `server/lib/calendarActivitySync.ts` + tests: `created`/`moved`/
   `cancelled`-klassificering, 410-håndtering (rydder state, fuld
   resynk), redaction af private aftaler.
3. [ ] `calendarActivitySync.ts` koblet ind i `index.ts`s eksisterende
   `*/5 * * * *`-cron-gren (ingen ændring i `wrangler.jsonc`, jf.
   beslutning 4).
4. [ ] `GET /activity/since-last-login`-rute + tests: baseline-logik,
   ingen-baseline-tilfælde, tom familie, prioriteret rækkefølge.
5. [ ] Frontend: `ActivityTeaserCard` + `ActivitySummaryDialog` +
   `ActivityFullListDialog`, indsat i `HomePage.tsx` mellem hilsenen og
   den eksisterende to-kolonne-grid.
6. [ ] Luk-tilstand (localStorage) + tests.
7. [ ] Manuel test på beta (kræver et rigtigt cron-tick + to reelle
   login-forløb for at se en ægte "siden sidst"-periode) — Nicolaj
   bekræfter ved lejlighed, samme mønster som tidligere sprints.
8. [ ] Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`) → commit → push
   → verificér grøn CI + begge Workers Builds → merge.

---

## Kendte risici

1. **Flere enheder pr. bruger.** Login er globalt pr. bruger, ikke pr.
   enhed (beslutning 1). Tjekker man appen fra både telefon og tablet,
   bliver "sidst logget ind" den seneste af de to — perioden kan blive
   kortere end forventet.
2. **Synk-blind vinkel ved udløbet `syncToken`.** Et 410-svar tvinger en
   fuld resynk; ændringer i det præcise tidsrum tokenet var ugyldigt kan i
   sjældne tilfælde glippe. Samme accepterede begrænsning som enhver
   kalender-synk-klient.
3. **Familie-bredt, ikke personligt filtreret** (beslutning 9). I store
   familier med meget aktivitet kan overblikket blive støjende — værd at
   revidere, hvis det viser sig i praksis.
4. **Samme Google-konto-begrænsning som delelink og ugeresumé** (Sprint 26/
   28) — kalenderdelen af overblikket forudsætter, at mindst ét
   familiemedlem har en aktiv Google-forbindelse.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
