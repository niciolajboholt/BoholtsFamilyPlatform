# 27_Sprint27_Tidsbaserede_Paamindelser_Plan

> Status: Afventer godkendelse

Version: 1.0

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

Fjerde sprint i roadmappen efter det eksterne review. Sprint 23's
opgave-/rutinemodul har allerede et valgfrit tidspunkt (`time_of_day`) pr.
opgave — men det bruges i dag **kun til sortering** (Tiimo-tidslinje-stil),
ikke til en push-notifikation der affyres *på* tidspunktet. Det var en
bevidst afgrænsning i Sprint 23 ("Ingen tidsbaserede påmindelser i v1" —
krævede en Cron Trigger, som appen ikke havde endnu). Sprint 24 indførte
appens første Cron Trigger (daglig session-oprydning), så infrastrukturen
findes nu. Dette sprint lukker hullet: et sat tidspunkt sender en
push-notifikation, når tiden kommer.

---

## Beslutninger

1. **Ny Cron Trigger hvert 5. minut** (`*/5 * * * *`), ved siden af Sprint
   24's daglige (begge kører på samme `scheduled()`-handler i `index.ts`,
   adskilt via `controller.cron`-strengen). 5 minutters præcision er
   rigeligt til en familie-påmindelse ("sengetid kl. 20") og holder
   Worker-forbrug lavt.
2. **En påmindelse er en tidsvinduematch, ikke en eksakt streng-match.**
   `time_of_day` (fx "14:37") kan være sat til et hvilket som helst
   klokkeslæt af brugeren i dag — for at undgå at kræve UI'et ændres til
   kun 5-minutters-intervaller, matcher hvert cron-tick i stedet et
   **vindue**: `time_of_day` falder inden for
   `[nu afrundet ned til nærmeste 5 min, +5 min)`.
3. **Serveren regner selv tid ud i `Europe/Copenhagen`, første gang
   nogensinde.** Cloudflare Workers kører i UTC, og alt andet i appen
   (dato-materialisering af opgaver, kalendervisning) er hidtil styret af
   klientens egen lokale dato/tid, sendt med i requesten — der er intet
   "server regner selv ud hvilken dag/tid det er"-kode i dag. Et
   `scheduled()`-kald har ingen klient at spørge, så serveren skal selv
   udlede "nu" via `Intl.DateTimeFormat` med `timeZone: "Europe/Copenhagen"`
   (indbygget i JS, ingen ny afhængighed) — samme antagelse som appens
   øvrige da-DK/dansk-only design, blot nu eksplicit i serverkode.
4. **Cron-jobbet materialiserer også dagens rutine-opgaver — ikke kun
   opret-tjek ved besøg.** Sprint 23's lazy-materialisering
   (`materializeTasksForDate()`) kører i dag kun, når nogen åbner
   opgavesiden. Hvis ingen åbner appen den dag, findes rutinens
   konkrete opgaver for dagen slet ikke endnu — og en påmindelse har intet
   at pege på. Cron-jobbet kalder derfor `materializeTasksForDate()` for
   **alle** familier ved hvert tick (billigt/idempotent via eksisterende
   `INSERT OR IGNORE` + unik-indeks — ingen ændring af selve funktionen
   nødvendig), før det leder efter forfaldne påmindelser.
5. **Én påmindelse pr. opgave, aldrig gentaget.** Ny kolonne
   `tasks.reminded_at` — sat når påmindelsen er sendt, forhindrer
   dobbelt-afsendelse (fx hvis cron-jobbet af en eller anden grund kører
   to gange i samme vindue).
6. **Kun opgaver med et sat tidspunkt, der endnu ikke er udført.** En
   allerede afkrydset opgave (`is_done = 1`) får ingen påmindelse — samme
   logik ville være forvirrende ellers.
7. **Samme modtager-logik som "ny opgave"-notifikationen** (Sprint 23's
   `notifyForTask()`): tildelt til ét medlem → kun det medlems linkede
   bruger; tildelt "hele familien" → alle undtagen den der oprettede
   opgaven (irrelevant her, da påmindelsen ikke har en "afsender" —
   sendes til alle familiens linkede brugere).

---

## Teknisk tilgang

- Migration 0011: `ALTER TABLE tasks ADD COLUMN reminded_at TEXT`.
- `wrangler.jsonc`: `triggers.crons` udvides til `["0 4 * * *", "*/5 * * * *"]`
  (prod + beta).
- `index.ts`s `scheduled()`-handler: ved `*/5 * * * *`-tick, kald en ny
  `sendDueTaskReminders(env)` (`server/lib/taskReminders.ts`):
  1. Udled dagens dato + nuværende 5-minuts-vindue i `Europe/Copenhagen`.
  2. `SELECT id FROM families` → for hver familie, kald
     `materializeTasksForDate(db, familyId, today)` (genbruger
     `tasks.ts`s eksisterende funktion, eksporteret).
  3. `SELECT ... FROM tasks WHERE task_date = ? AND is_done = 0 AND
     reminded_at IS NULL AND time_of_day >= ? AND time_of_day < ?`
     (vinduematch, jf. beslutning 2).
  4. For hver forfalden opgave: send push (genbruger `notifyForTask()`,
     eksporteret fra `tasks.ts`), sæt `reminded_at = nu`.
- Al databasetilgang sker i `scheduled()`s `ctx.waitUntil()`, som Sprint
  24's oprydning — Cloudflares egen timeout for scheduled-handlere er
  længere end for almindelige requests, men koden skal stadig ikke
  blokere unødigt.

---

## Rækkefølge

1. Migration 0011 (`reminded_at`), eksportér `materializeTasksForDate()`
   og `notifyForTask()` fra `tasks.ts`.
2. `server/lib/taskReminders.ts`: `sendDueTaskReminders()` + automatiserede
   tests (vindue-match, allerede-sendt springes over, udført opgave
   springes over, materialisering sker for alle familier, korrekt
   modtager pr. tildelingstype).
3. Cron Trigger tilføjet i `wrangler.jsonc` (prod + beta), koblet ind i
   `index.ts`s `scheduled()`.
4. Manuel test på beta/produktion — udestår i sagens natur til bagefter
   (kræver at vente på et rigtigt cron-tick og se en rigtig push
   ankomme), Nicolaj bekræfter ved lejlighed.
5. Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`) → commit → push →
   verificér grøn CI + begge Workers Builds → merge `develop` til `main`.

---

## Kendte risici

1. **Første gang serveren selv regner tid ud i en bestemt tidszone** —
   `Intl.DateTimeFormat`s Copenhagen-håndtering af sommer-/vintertid skal
   testes eksplicit omkring et tidspunkt, hvor det rent faktisk betyder
   noget (fx en test der låser en fast dato midt i sommertid), ikke kun
   antages korrekt.
2. **Materialisering af ALLE familier ved hvert 5. minuts-tick** er billigt
   ved appens nuværende skala (én familie), men vokser lineært med
   familie-antal — acceptabelt nu, men værd at revidere hvis appen nogensinde
   skalerer ud over enkelte familier (ikke planlagt).
3. **5-minutters-vinduet kan i sjældne tilfælde springes over**, hvis
   Cloudflare af en eller anden grund skipper et enkelt cron-tick (fx ved
   en platform-udrulning) — påmindelsen ville da slet ikke blive sendt for
   det tidspunkt, ikke blot forsinket, fordi vinduematchen er eksakt, ikke
   et "send hvis endnu ikke sendt og tidspunktet er passeret"-tjek.
   Accepteret som en sjælden, lav-konsekvens kant (en enkelt overset
   familie-påmindelse), fremfor at komplicere logikken med et bredere
   "efterslæb"-tjek.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
