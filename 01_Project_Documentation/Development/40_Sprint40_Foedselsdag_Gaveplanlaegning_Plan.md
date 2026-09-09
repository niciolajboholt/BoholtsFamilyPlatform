# 40_Sprint40_Foedselsdag_Gaveplanlaegning_Plan

> Status: Forslag — afventer godkendelse af scope/rækkefølge

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-09

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Gaveideer og budget knyttet til familiemedlemmers fødselsdage, med
påmindelser via den eksisterende tidsbaserede påmindelses-infrastruktur
(Sprint 27/31).

---

## Verificeret grundlag — VIGTIG RETTELSE til udbygningsplanen

Udbygningsplanens Del B påstod, at fødselsdage "allerede findes som data
(personlige farver/relationer)". Det er **kontrolleret direkte mod skemaet
og er ikke korrekt**: `family_members`
(`server/migrations/0003_families.sql`) har kun `id`, `family_id`, `name`,
`color`, `relation`, `is_placeholder_name`, `linked_user_id`,
`created_at` — intet fødselsdags- eller datofelt findes noget sted i
kodebasen. Dette sprint skal derfor selv indføre fødselsdagsdata, ikke
kun bygge gaveplanlægning oven på eksisterende data.

Til gengæld findes den relevante påmindelsesmekanik allerede:
`event_reminders` (`0016_event_reminders.sql`) sender push-påmindelser
via det eksisterende 5-minutters cron-tick, med et `offset_minutes`-felt
og en `last_sent_occurrence_start`, der specifikt er designet til
ÅRLIGT TILBAGEVENDENDE begivenheder (kommentaren nævner eksplicit
fødselsdage som eksempel) — men er bygget til Google-kalenderaftaler
(`event_id`-formatet er `google-event:<kalenderId>:<googleEventId>`), ikke
en vilkårlig dato i D1. Skal genbruges som MØNSTER, ikke direkte som
tabel.

---

## Foreslåede beslutninger

1. **Nyt nullable felt `birthday` (ISO-dato, uden år ELLER med år —
   afklares) på `family_members`.** En simpel `ALTER TABLE`, samme mønster
   som `0011_task_reminders.sql`s tilføjelse af `reminded_at` til `tasks`.
2. **Ny tabel `birthday_gift_plans`**: `id`, `family_id`,
   `family_member_id` (hvem fødselsdagen er for), `year`, `gift_idea`,
   `budget_amount`, `is_purchased`, `created_by_user_id`, `created_at`.
   `year` med i nøglen, så gaveideer for samme person ikke blandes sammen
   år efter år.
3. **Privatliv: gaveplaner for person X må ikke vises til X selv**, hvis
   personen har en tilknyttet bruger (`linked_user_id`) — ellers
   ødelægges overraskelsen for en teenager/voksen med egen konto. Børn
   uden egen konto (ADR-017 punkt 5) har intet login at skjule det for,
   så begrænsningen er reelt kun relevant for `linked_user_id IS NOT NULL`.
   Dette er en ny type adgangsregel i appen (data skjult for ÉT specifikt
   familiemedlem, ikke rolle-baseret som ellers) og bør skrives som en
   kort ADR, ikke bare implementeres stiltiende.
4. **Egen påmindelsesmekanik, ikke genbrug af `event_reminders`-tabellen.**
   En ny, simplere tabel `birthday_reminders` (eller blot et fast,
   ukonfigurerbart "7 dage før" i v1, uden egen tabel) — `event_reminders`
   er tæt koblet til Google-kalenderens event-id-format og ville kræve en
   kunstig omvej for at bruges til en D1-intern dato. Cron-jobbet
   genbruger derimod PRINCIPPET (offset før en årligt tilbagevendende
   dato) og lægges på det EKSISTERENDE daglige cron-tick (`0 4 * * *`,
   se index.ts) — ikke en ny cron-trigger, da kontoen kun har 2 ledige
   tilbage af sit loft på 5 (se ADR-018).
5. **UI:** et nyt afsnit i Indstillinger (samme mønster som
   `FamilySection.tsx`) til at sætte fødselsdag pr. medlem, og en ny,
   simpel `BirthdayGiftPlansDialog` tilgængelig fra forsiden eller
   Indstillinger — ikke en helt ny hovedside/rute, da omfanget er for
   lille til at retfærdiggøre det.

---

## Kendte risici og åbne spørgsmål

- **År eller ikke år på `birthday`:** uden fødselsår kan appen ikke vise
  "bliver 8 år", kun selve datoen — bør afklares med Nicolaj, da det er
  en reel produktbeslutning, ikke kun en datatype-detalje.
- **ADR påkrævet** for beslutning 3 (skjult data for ét specifikt
  familiemedlem) — nyt princip i appens adgangsmodel, som ellers
  udelukkende er rolle-baseret (ejer/admin/medlem).
- **Cron-loft:** hvis en fremtidig sprint også har brug for en ny
  cron-trigger, er der kun ét sæde tilbage efter dette sprints genbrug af
  det daglige tick — værd at holde for øje ved prioritering af Del B's
  resterende punkter.

---

## Kvalitetsgate

Som de øvrige sprints: `npm run lint`, `npm run build`, `npm test`,
`npm run test:e2e` grønne før merge. Nye migrationer (birthday-felt +
gift_plans-tabel) verificeres manuelt med `SELECT ... FROM sqlite_master`
på beta.
