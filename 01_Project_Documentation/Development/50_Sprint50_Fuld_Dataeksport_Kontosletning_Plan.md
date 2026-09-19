# 50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Idé-/planlægningsstadie — intet af nedenstående er påbegyndt. Skrevet som
opfølgning på Sprint 49's privatlivspolitik-korrektion, som afdækkede at
den nuværende "Eksportér data"-funktion kun dækker lokale enheds-data, og
at der slet ikke findes en kontosletningsfunktion (se
`49_Sprint49_Hjemmecentralen_Launch_Prep_Plan.md`, afsnit A2).

---

## Formål

Bygge en reel, selvbetjent server-side dataeksport og en kontrolleret
kontosletning, så privatlivspolitikkens "kontakt os for sletning/eksport"
(Sprint 49's midlertidige løsning) på sigt kan erstattes af noget
brugeren selv kan udføre. IKKE implementeret i dette dokument — kun
planlagt, jf. opgavens eksplicitte afgrænsning: "Implementér ikke et
stort og risikabelt slette-/eksportsystem uden først at vurdere omfanget."

---

## Nuværende tilstand (verificeret, Sprint 49)

- `createDataBackup()` (`dataBackupStorage.ts`) eksporterer kun
  `localStorage`-nøgler med præfikset `boholts-family-` — ingen server-kald.
- Ingen route sletter en bruger (`users`-tabellen), en families data samlet,
  eller kobler et sletningsforløb til en session/genautentificering.
- Individuelle rækker (opgaver, indkøbsvarer, medlemmer, gift-planer,
  udgifter, forbindelser) kan slettes ét ad gangen af en ejer/admin — det
  er almindelig redigering, ikke en kontosletningsfunktion.
- D1-skemaet (migrationerne 0001-0030) har ingen `ON DELETE CASCADE`
  kortlagt for en "slet hele familien"-operation — det skal undersøges
  tabel for tabel, ikke antages.

---

## Omfang: hvad "komplet eksport" reelt betyder

En brugers data er spredt over flere ejerskabsniveauer, som en eksport må
skelne mellem:

1. **Brugerens egen konto** (`users`, `sessions`, `google_connections`,
   `microsoft_connections`, `icloud_connections`, `push_subscriptions`).
2. **Data brugeren ejer inden for en familie**, men som andre
   familiemedlemmer også ser og er afhængige af (opgaver, indkøbslister,
   måltidsplaner, fødselsdage/gaveplaner, fællesøkonomi, kalender-
   mappings, delelinks, ICS-abonnementer).
3. **Familien som helhed** (`families`, `family_members`,
   `family_memberships`) — ejes ikke af én bruger alene.

En "eksportér mine data"-knap kan teknisk kun ansvarligt dække (1) fuldt
ud og (2) som en kopi (ikke en fjernelse). En "slet min konto"-handling
rejser et produktspørgsmål, der SKAL besluttes af Nicolaj før
implementering (se "Åbne produktbeslutninger" nedenfor) — fx hvad der
sker med en families delte data, når det sidste/eneste medlem med adgang
sletter sig selv.

---

## Foreslået teknisk tilgang (til godkendelse, ikke bygget)

### Eksport

- Ny route, fx `GET /api/families/:id/export`, kun tilgængelig for en
  autentificeret bruger med medlemskab af familien.
- Samler samtlige rækker fra D1 knyttet til `family_id` på tværs af
  `family_members`, `tasks`, `task_routines`, `shopping_lists` (+ items +
  templates), `meal_plan_entries`, `birthday_gift_plans`,
  `shared_expenses`, `allowance_ledger`, `calendar_member_mappings`,
  `ics_calendar_subscriptions`, `icloud_calendar_connections` (uden selve
  krypterede adgangskoder/tokens), `family_share_links`,
  `family_enabled_features`, samt brugerens egen `users`-række.
- Leveres som en downloadbar JSON- (maskin­læsbar) eller kombineret
  JSON+PDF-fil (læsbar), genereret on-demand — ikke gemt på serveren
  længere end det tager at streame svaret.
- Rate-limitet (samme mønster som AI-ruter/delelinks, Sprint 29).
- Krypterede felter (OAuth-tokens, iCloud-adgangskode) eksporteres
  ALDRIG i klartekst — kun metadata (fx "Google-forbindelse oprettet
  <dato>").

### Kontosletning

- To-trins flow: (1) vis brugeren præcis konsekvensen — hvilke data
  slettes, hvilke data forbliver (fx andre familiemedlemmers opgaver de
  selv har oprettet), og om familien opløses eller brugeren blot
  fjernes som medlem; (2) kræv eksplicit bekræftelse (indtast familiens
  navn el.lign., samme mønster som destruktive GitHub/Cloudflare-flows)
  OG en frisk genautentificering (ikke bare en gyldig session — brugeren
  skal bekræfte sin identitet igen, fx via et nyt OAuth-round-trip eller
  en tidsbegrænset re-login).
- Server-side transaktion (D1 batch) der enten gennemføres helt eller
  slet ikke — ingen delvis sletning.
- Logges (uden personhenførbare detaljer ud over et anonymt
  hændelses-id) til drift-overvågning, så en fejlagtig eller
  ondsindet sletning kan opdages.
- **Ingen automatisk sletning af en hel families data ved ét medlems
  anmodning**, medmindre brugeren udtrykkeligt er familiens eneste
  medlem — ellers reduceres handlingen til "fjern mig fra familien og
  slet min egen konto", med et separat, tydeligt markeret
  "slet hele familien"-flow for en ejer, der eksplicit vælger det.

---

## Åbne produktbeslutninger (kræver Nicolajs svar før kodning)

1. Hvad sker der med en opgave/udgift, en slettet bruger har oprettet, men
   som stadig er relevant for resten af familien — slettes den, eller
   forbliver den med brugeren vist som "Tidligere medlem"?
2. Skal en ejer kunne slette hele familien (alle medlemmers data), eller
   kun sig selv?
3. Skal eksporten inkludere andre familiemedlemmers personoplysninger
   (navn, e-mail), eller kun den anmodende brugers egne data plus
   ikke-personhenførbar familiedata (opgavetekster, indkøbsvarer)?
4. Opbevaringsfrist: skal en slettet konto/familie kunne gendannes inden
   for en periode (fx 30 dage, som mange tjenester tilbyder), eller
   slettes data øjeblikkeligt og permanent?

---

## Teststrategi (når planen godkendes og implementeres)

- Enhedstests for hver tabel, der indgår i eksport/sletning — bekræft at
  INGEN tabel med `family_id`/`user_id` er glemt (fx ved at sammenholde
  eksport-routens tabelliste programmatisk mod `server/migrations/*.sql`).
- Tests der bekræfter at sletning IKKE lækker en anden families data
  (samme mønster som eksisterende `does not let ... from another family`-
  tests i `families.test.ts`).
- Tests for det to-trins bekræftelses-/genautentificeringsflow, inkl. at
  en udløbet eller manglende genautentificering blokerer sletningen.
- Manuel test af en reel eksportfil mod en reel, udfyldt testfamilie, med
  visuelt gennemsyn af at intet krypteret felt lækkes i klartekst.

---

## Eksplicit ikke besluttet af dette dokument

Dette dokument anbefaler en tilgang, men træffer IKKE selv beslutningen om
at bygge den. Implementering afventer Nicolajs godkendelse af omfanget og
svar på de åbne produktbeslutninger ovenfor.
