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
Implementeret 2026-09-19. Nicolaj besvarede planens fire åbne
produktbeslutninger (se afsnittet nedenfor, nu markeret med svar), og
implementeringen fulgte den foreslåede tekniske tilgang. En efterfølgende
hardening-gennemgang 2026-09-19 lukkede fire launch-blokeringer:
familier kan ikke efterlades uden ejer ved personlig kontosletning,
eksporten dækker alle klassificerede familie-tabeller uden bearer-
credentials, schema-health dækker migration 0031, og destruktive flows
kræver nu en servervalideret bekræftelsestekst ud over frisk OAuth:
server-side dataeksport (migration 0031, `server/lib/dataExport.ts`,
`GET /api/families/:id/export`), og et to-trins konto-/familiesletnings-
flow med gen-autentificering (`server/lib/accountDeletion.ts`,
`POST /api/account/deletion/*` og `POST /api/families/:id/deletion/*`),
30 dages fortrydelsesperiode (purge kører på den eksisterende daglige
Cron Trigger) og UI i Indstillinger (`AccountDataSection.tsx`). Se
`CHANGELOG.md` for commit-detaljer.

---

## Formål

Bygge en reel, selvbetjent server-side dataeksport og en kontrolleret
kontosletning, så privatlivspolitikkens "kontakt os for sletning/eksport"
(Sprint 49's midlertidige løsning) erstattes af noget, brugeren selv kan
udføre. Den oprindelige plan blev først risikovurderet og derefter
implementeret i Sprint 50; dette dokument beskriver nu både beslutninger,
implementering og efterfølgende hardening.

---

## Udgangspunkt før implementering (verificeret, Sprint 49)

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

## Implementeret teknisk tilgang

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
- `FAMILY_EXPORT_POLICY` klassificerer alle migrerede tabeller som
  eksporteret, bevidst udeladt driftsdata eller ikke-familiedata. En test
  sammenholder politikken med det faktiske migrerede schema, så en ny
  tabel ikke kan blive glemt stiltiende.
- Aktive delelinktokens, invitationskoder, sessionsdata, push-endpoints,
  fulde ICS-bearer-URL'er og synk-tokens eksporteres aldrig. For iCloud,
  ICS og delelinks eksporteres kun sikre metadata.

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
- En aktiv familie må aldrig blive ejerløs: en ejer skal overdrage
  ejerskabet, eller — som eneste bruger — gennemføre det særskilte
  familiesletningsflow, før personlig kontosletning tillades. Reglen
  håndhæves server-side.
- Personlig kontosletning kræver den eksakte tekst `SLET MIN KONTO`;
  familiesletning kræver familiens eksakte navn. Begge dele valideres
  server-side efter frisk OAuth-genautentificering.

---

## Åbne produktbeslutninger — besvaret af Nicolaj 2026-09-19

1. Hvad sker der med en opgave/udgift, en slettet bruger har oprettet, men
   som stadig er relevant for resten af familien — slettes den, eller
   forbliver den med brugeren vist som "Tidligere medlem"?
   **Svar: forbliver, vises som "Tidligere medlem".** Implementeret ved at
   `purgeExpiredDeletions()` anonymiserer (ikke sletter) `users`-rækken
   ved purge — se `accountDeletion.ts`.
2. Skal en ejer kunne slette hele familien (alle medlemmers data), eller
   kun sig selv? **Svar: begge flows.** Begge er bygget — se
   `requestAccountDeletion()`/`requestFamilyDeletion()`.
3. Skal eksporten inkludere andre familiemedlemmers personoplysninger
   (navn, e-mail), eller kun den anmodende brugers egne data plus
   ikke-personhenførbar familiedata (opgavetekster, indkøbsvarer)?
   **Svar: afhænger af rollen** — ejeren kan eksportere hele familien
   (inkl. andre medlemmers navn/e-mail), et almindeligt medlem kun sin
   egen konto plus egen kalender/opgaver. Se `dataExport.ts`'s
   `buildFamilyExport()` vs. `buildMemberExport()`.
4. Opbevaringsfrist: skal en slettet konto/familie kunne gendannes inden
   for en periode (fx 30 dage, som mange tjenester tilbyder), eller
   slettes data øjeblikkeligt og permanent? **Svar: 30 dage.** Se
   `DELETION_RETENTION_DAYS` i `accountDeletion.ts`.

---

## Teststrategi og regressionstest

- Enhedstests for hver tabel, der indgår i eksport/sletning — bekræfter at
  INGEN tabel med `family_id`/`user_id` er glemt (fx ved at sammenholde
  eksport-routens tabelliste programmatisk mod `server/migrations/*.sql`).
- Tests bekræfter at eksport IKKE lækker en anden families data
  (samme mønster som eksisterende `does not let ... from another family`-
  tests i `families.test.ts`).
- Tests for det to-trins bekræftelses-/genautentificeringsflow, inkl. at
  en udløbet eller manglende genautentificering blokerer sletningen.
- Regressionstest dækker desuden ejerblokering/ejerskifte, eneste ejer,
  manglende Sprint 50-schemaelementer, fremtidige/ugyldige reauth-
  timestamps og fravær af bearer-credentials i eksporten.
- Manuel test af en reel eksportfil mod en reel, udfyldt testfamilie, med
  visuelt gennemsyn af at intet krypteret felt lækkes i klartekst.

---

## Manuelt opfølgningspunkt — verificeret 2026-09-19

Live flow-verifikation mod beta-miljøet (rigtig OAuth-roundtrip for
gen-autentificering, kontosletning/fortrydelse, dataeksport) kunne ikke
køres fra sandboxen — kun automatiserede enheds-/rutetests (17 + 8 + 8
nye tests, se `server/lib/accountDeletion.test.ts`,
`server/routes/account.test.ts`,
`server/routes/familyRoutes/familyDeletion.test.ts`). **Nicolaj har
efterfølgende bekræftet manuelt i beta at flowet virker.** Tidligere
anbefalet tjek (nu udført): opret en testfamilie i beta, bed om
kontosletning, bekræft at man logges ud og kan fortryde ved login, og at
`/api/families/:id/export` giver et brugbart JSON-svar for både ejer og
medlem.

Den efterfølgende hardening er automatisk verificeret, men skal deployes
til beta og have et kort ikke-destruktivt UI-smoketest, før samme manuelle
status kan overføres til den ændrede bekræftelsesoplevelse. En reel
automatisk purge efter 30 dage er fortsat **ikke manuelt verificeret**;
den er dækket af isolerede tests og må ikke fremprovokeres mod rigtige
beta-/produktionsdata.
