# 28_Sprint28_AI_Ugeresume_Plan

> Status: Godkendt, kode gennemført

Version: 1.1

Project:
Boholts Family Platform

Last Updated:
2026-08-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Femte og sidste sprint i den nåværende roadmap efter det eksterne review.
Et AI-genereret ugeresumé til familien: en kort, venlig dansk opsummering
af den kommende uges kalenderaftaler, opgaver og indkøbsliste — leveret
som en push-notifikation og synlig i appen, via Cloudflare Workers AI
(samme model/mønster som Sprint 23's rutine-/ingrediensforslag).

---

## Beslutninger

1. **Ugentlig Cron Trigger** — søndag kl. 18:00 dansk tid (`0 17 * * SUN` UTC,
   samme pragmatiske forenkling som Sprint 24/27's faste UTC-cron'er: et
   fast klokkeslæt der forskyder sig en time omkring sommertidsskift,
   accepteret fremfor at genberegne cron-udtrykket to gange om året).
   Klar til ugen, der starter mandag.
2. **Tre datakilder, alle allerede tilgængelige server-side**:
   - **Kalender**: næste 7 dages aftaler, via Sprint 26's
     `googleCalendarAggregation.ts` (genbruges uændret) — samme
     begrænsning som delelinket: ét familiemedlems Google-forbindelse
     (se "Flere Google-konti pr. familie", stadig ikke planlagt).
   - **Opgaver**: åbne (ikke udførte) opgaver for de næste 7 dage. Kræver
     at rutine-opgaver er materialiseret for alle 7 dage, ikke kun i dag —
     cron-jobbet udvider derfor Sprint 27's mønster og kalder
     `materializeTasksForDate()` for hver af de kommende 7 dage, for hver
     familie, før det læser opgaverne.
   - **Indkøbsliste**: ikke-afkrydsede varer på tværs af familiens lister.
3. **Fri tekst, ikke struktureret JSON.** Sprint 23's AI-kald beder om et
   præcist JSON-skema, fordi resultatet skal parses ind i konkrete
   felter (rutine-navn, ikoner, osv.). Et resumé er derimod ren
   læsetekst — AI'en bedes om et kort afsnit på dansk, ingen parsing
   nødvendig.
4. **Resuméet gemmes** (ny tabel `family_weekly_summaries`: familie, uge,
   tekst, genereret-tidspunkt) — ikke kun sendt som en flygtig
   notifikation. Én pr. familie pr. uge, så det kan ses i appen bagefter,
   uden at skulle gen-generere (og dermed bruge Workers AI-budget) hver
   gang nogen kigger.
5. **Vises på forsiden** (`HomePage.tsx`), som et nyt kort — samme
   "bundet til rigtige data, ærlig tom-tilstand"-princip som resten af
   forsiden (Sprint 20). Tydeligt mærket som AI-genereret, med en kort
   note om at det kan indeholde fejl — i modsætning til Sprint 23's
   rutine-/ingrediensforslag har et resumé ingen "gem"-handling at
   godkende (det er ren information, ikke et udkast der bliver til en
   ny opgave/vare), men brugeren skal stadig vide, at det er en AI, der
   har skrevet det.
6. **Ingen push, hvis generering fejler** — springes stille over den uge
   (logges), i stedet for at sende en tom eller fejlbehæftet notifikation.
   Prøves automatisk igen næste søndag.
7. **Kun for familier, der reelt har data at opsummere.** Hvis en familie
   hverken har kommende aftaler, åbne opgaver eller varer på
   indkøbslisten, springes den over — ingen notifikation, intet tomt
   resumé gemt.

---

## Teknisk tilgang

- Migration 0012: `family_weekly_summaries (id TEXT PK, family_id, week_start
  TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL)`, unikt indeks på
  `(family_id, week_start)`.
- `server/lib/aiAssistant.ts`: ny `generateWeeklySummary(env, input): Promise<string
  | null>` — samme `runChatCompletion()`-hjælpefunktion som allerede
  findes, men beder om fri tekst i stedet for at gå gennem
  `extractJsonObject()`.
- Ny `server/lib/weeklySummary.ts`: `sendWeeklySummaries(env)`, kaldt fra
  `index.ts`s `scheduled()` ved det nye ugentlige cron-tick (skelnes via
  `controller.cron`, samme mønster som Sprint 27):
  1. For hver familie: materialisér opgaver for de næste 7 dage, hent
     kalenderaftaler (Sprint 26's aggregeringsfunktion, alle
     kortlagte medlemmer), åbne opgaver, ikke-afkrydsede varer.
  2. Spring familien over, hvis intet af det tre findes (beslutning 7).
  3. Byg en kort dansk brugerprompt af de tre datakilder,
     kald `generateWeeklySummary()`.
  4. Ved succes: gem i `family_weekly_summaries`, send push
     (`sendPushNotificationToFamily`) med et kort uddrag + link til
     forsiden.
- `GET /api/families/:id/weekly-summary`: nyeste gemte resumé for
  familien (eller `null`), vist i et nyt kort på `HomePage.tsx`.

---

## Rækkefølge

1. ~~Migration 0012 (`family_weekly_summaries`).~~ ✅ **Gennemført**.
2. ~~`generateWeeklySummary()` i `aiAssistant.ts` + tests.~~ ✅
   **Gennemført**: 5 tests.
3. ~~`server/lib/weeklySummary.ts`: `sendWeeklySummaries()` + automatiserede
   tests (springer tomme familier over, gemmer korrekt, sender push kun
   ved succes, materialiserer 7 dage frem).~~ ✅ **Gennemført**: 6 tests,
   inkl. eksplicit test af manglende Google-forbindelse (risiko 1) og af
   materialisering på tværs af alle 7 dage.
4. ~~Cron Trigger tilføjet i `wrangler.jsonc` (prod + beta), koblet ind i
   `index.ts`s `scheduled()`.~~ ✅ **Gennemført**: tredje cron
   (`0 17 * * SUN`), skelnes fra de to øvrige via `controller.cron`.
   **Justeret under implementering**: oprindeligt skrevet som
   `0 17 * * 0` (unix-konventionen, 0=søndag) — Cloudflares cron-dialekt
   bruger i stedet `1-7` for ugedage (1=søndag), så det tal fejlede
   deploybuildet til beta med "invalid cron string" (produktionsbuildet
   nåede at deploye, INDEN beta-fejlen blev opdaget — se
   "Kendte risici" nedenfor). Rettet til `SUN` (Cloudflares egen
   anbefalede notation, undgår enhver tvetydighed).
5. ~~`GET /:id/weekly-summary`-rute + klient-kort på `HomePage.tsx`.~~ ✅
   **Gennemført**: `WeeklySummaryCard` vises kun, når et resumé rent
   faktisk findes (ingen permanent tom-tilstand indtil første søndag).
6. Manuel test på beta/produktion — udestår i sagens natur til bagefter
   (kræver at vente på et rigtigt ugentligt cron-tick), Nicolaj bekræfter
   ved lejlighed.
7. Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`) → commit → push →
   verificér grøn CI + begge Workers Builds → merge `develop` til `main`.

---

## Kendte risici

1. **Samme Google-konto-begrænsning som delelinket** (Sprint 26) — hvis
   familien ikke har nogen forbundet Google-konto, eller den forbundne
   konto mister sin forbindelse, udelades kalenderdelen stille fra
   resuméet (ikke en fejl, blot mindre at opsummere).
2. **AI-modellen kan tage fejl eller opfinde detaljer** — resuméet er
   information, ikke en kilde til sandhed; en tydelig mærkning i UI'et
   ("AI-genereret, kan indeholde fejl") er den eneste beskyttelse, da der
   (i modsætning til Sprint 23) ikke er en gem-handling at gate bag et
   menneskes godkendelse.
3. **Materialisering 7 dage frem, ugentligt, for alle familier** er
   billigt ved appens nuværende skala (samme resonnement som Sprint 27's
   risiko 2) — værd at revidere, hvis appen nogensinde skalerer ud over
   enkelte familier.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
