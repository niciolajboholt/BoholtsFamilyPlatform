# 20_Sprint20_Familie_Server_Plan

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-13

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Revideret, GitHub-forankret plan for resten af Sprint 20 (ADR-017:
multi-tenant familie-server). Erstatter `lexical-dancing-liskov.md`, som lå
løst på `main` (uploadet manuelt via GitHub, ikke en del af den almindelige
gren-arbejdsgang) — indholdet derfra er indarbejdet her, krydstjekket mod den
faktiske kode på `feature/sprint-20-fase*`-branchene, ikke kun mod den
oprindelige plans antagelser.

Princip fremover: alt planlægningsarbejde for Sprint 20 lever i dette
dokument på `develop`, ikke i lokale filer — så både Nicolaj og enhver
AI-agent altid arbejder fra samme, opdaterede grundlag.

---

## Baggrund

Se ADR-017 i `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`
for selve arkitekturbeslutningen (server-ejet Google-login, multi-tenant
familier, D1 gemmer aldrig selve kalenderaftalerne). Dette dokument er
eksekveringsplanen — hvad der er gjort, hvad der mangler, og i hvilken
rækkefølge.

---

## Status pr. fase (2026-08-14)

| Fase | Indhold | Status |
|---|---|---|
| 0 | Cloudflare Worker + D1-fundament | ✅ Merget til `develop` |
| 1 | Server-ejet Google-login + session | ✅ Merget til `develop`, verificeret på beta 2026-08-02 |
| 2 | Familier, medlemskab, invitationer | ✅ **Merget til `develop`** (PR #29, 2026-08-14). Christines fulde test af invitationsflowet på beta gennemført og godkendt. 24 rute-tests. |
| 3 | Server overtager Google Kalender-sync | ✅ **Merget til `develop`** (PR #28, 2026-08-14). Manuel beta-verificering (forbind/opret/redigér/slet, bekræftet i Google Kalender) gennemført og godkendt. |
| 4 | Kalender-medlem-mapping → D1 | ✅ **Merget til `develop`** (PR #30, 2026-08-14). Rebaset mod opdateret `develop`, 27 rute-tests i alt, en cross-family valideringsbug fundet og rettet (se nedenfor). Mangler stadig rigtig beta-verificering af selve UI-flowet (Indstillinger → "Rediger familiemedlem"). |
| 5 | Udfas lokale (ikke-Google) aftaler + migrering | ✅ **Merget til `develop`** (2026-08-15). Nicolaj bekræftede ingen lokal data skulle bevares, så ingen backup-eksport var nødvendig. `LocalCalendarProvider`, `CalendarService`s localStorage-CRUD, demo-seed-data og `CalendarProviderType`'s `"local"`-variant er fjernet. Kendt, accepteret adfærdsændring: et familiemedlem uden tildelt kalender har nu ingen kalenderkilde overhovedet. 180/180 tests. |
| 6 | Oprydning + Cloudflare Access-beslutning | Ikke startet. 3 af planens DB-indekser er allerede tilstede (se nedenfor). |

**`develop` har nu login, familier/invitationer, server-styret Google-kalender-sync og delt kalender-medlem-mapping samlet.** Beta-Workeren kører denne kode efter merge af #29/#28/#30 (verificeret grønt CI + Cloudflare-build på alle tre PR'er).

### Bugs fundet og rettet undervejs (2026-08-13)

- **Fase 3**: `proxyToGoogle` i `server/routes/calendar.ts` byggede en
  `Response` med tekst-krop ved enhver statuskode — men Google svarer `204
  No Content` ved en vellykket event-sletning, og Fetch-specen forbyder en
  non-null body på en null-body-status. Enhver sletning af en aftale gennem
  serveren ville have fejlet med 500. Rettet ved at sende `null` som body,
  når svaret er tomt.
- **Fase 2**: sletning af et familiemedlem beskyttede det reserverede
  "Familien"-pseudomedlem med `AND id != 'family'` — men medlemmer sås med
  `crypto.randomUUID()`, ikke faste slugs (kan ikke være faste, da
  `family_members.id` er en global primærnøgle på tværs af alle familier).
  Tjekket matchede derfor aldrig noget rigtigt medlem, og pseudomedlemmet var
  reelt ubeskyttet. Rettet til `relation IS NOT NULL`, samme markør resten af
  filen allerede bruger.
- **Fase 4**: `PUT /:id/calendar-mappings/:calendarId` autoriserede kalderen
  som ejer/admin af familien i URL'en, men validerede aldrig at det angivne
  `familyMemberId` i request-body faktisk tilhørte den familie — samme
  klasse fejl som Fase 2-bugen ovenfor (global primærnøgle, ingen
  familie-scoping). En admin kunne i praksis knytte sin egen families
  kalender til et medlem-id fra en helt anden familie. Rettet ved at slå det
  målrettede medlem op scoped til både `id` og `family_id`, før upsert.
- **Fase 4, fundet ved rigtig brugertest (2026-08-14):** Nicolaj rapporterede
  at kalender-tildeling til "Familien" ikke gjorde noget, uden fejlmelding.
  Årsag: `familyMembersSync.ts` erstatter pseudomedlemmets rigtige server-id
  (en UUID, som ethvert andet medlem) med det faste, lokale
  `familyPseudoMemberId` ("family") overalt i klienten — så PUT-kaldet sendte
  bogstaveligt "family" som `familyMemberId`, hvilket fase 4-scoping-tjekket
  ovenfor korrekt afviste (ingen har det id). Fejlen forsvandt stille, fordi
  `FamilyMemberDialog`s gem-kald hverken afventer eller viser fejl ved en
  afvisning. Rettet ved at cache'e det rigtige server-id og oversætte begge
  veje i `calendarMemberMappingStorage.ts`. Almindelige navngivne medlemmer
  (Far/Mor/Barn) var upåvirkede — kun "Familien" ramte problemet.
- **Fase 4, femte bug, fundet ved fornyet brugertest (2026-08-14):** Nicolaj
  rapporterede at rettelsen ovenfor ikke var nok — tildeling til et
  almindeligt, navngivet medlem (Nicolaj/Far) virkede stadig ikke. Anden,
  uafhængig årsag i samme fil: `resolveFamilyId()` brugte
  `cachedFamilyId !== undefined` som "allerede slået op"-markør og cachede
  ethvert udfald permanent — inkl. et fejlet eller endnu-ikke-klart
  `/api/families/mine`-kald, som om brugeren simpelthen ingen familie havde.
  Ét tidligt, forbigående fejlet kald gjorde derfor kalender-tildeling
  stille-defekt for resten af sideindlæsningen, for ethvert medlem, ikke kun
  pseudomedlemmet. Rettet ved kun at cache et sandt (rigtigt) familie-id; et
  fejlet/null-udfald forsøges igen ved næste kald. Samtidig rettet:
  `setCalendarMemberMapping()` returnerer nu om det lykkedes, og
  `FamilyMemberDialog` afventer og viser en fejl i stedet for at lukke som om
  det virkede.

- **Fase 4, sjette bug, fundet ved fornyet brugertest (2026-08-14):** Efter
  femte bug var rettet og deployet, viste fejlmeldingen (som femte bugs
  fix netop tilføjede) sig for første gang — tildeling til "Familien"
  fejlede stadig, nu synligt: "Kalender-tildelingen kunne ikke gemmes." I
  `layouts/AppLayout.tsx` kørte den eneste effekt, der kalder
  `syncFamilyMembersFromServer()` (som sætter
  `getFamilyPseudoMemberServerId()`s cache) kun når `isFirstLaunch` var
  sand — en bevidst optimering for at spare et netværkskald for
  returnerende brugere med lokal data. Men den cache er ren in-memory og
  nulstilles ved hver sideindlæsning, så for enhver returnerende bruger
  (den normale situation efter første onboarding) forblev pseudomedlemmets
  rigtige server-id `null`, indtil en helt anden familiemedlem-redigering
  tilfældigvis nåede at gennemføre først. Rettet ved at tilføje en anden
  effekt — komplementet til den eksisterende betingelse (bruger til stede,
  `isFirstLaunch` falsk) — der varmer den samme cache op i baggrunden uden
  at blokere onboarding-tjekkets loading-tilstand. Ingen automatiseret
  regressionstest for denne — projektet har endnu ingen infrastruktur til
  at rendere React-komponenter i test, og at tilføje det var uden for
  denne rettelses omfang. Verificeret med lint, build og hele den
  eksisterende testpakke (189/189); afventer manuel gentest.

- **Fase 4, syvende og reelle rod-årsag, fundet ved direkte D1-opslag
  (2026-08-15):** Efter sjette bug var rettet og deployet, fejlede
  tildelingen *stadig* — samme synlige fejl. En direkte forespørgsel mod
  beta-D1'en (`d1_database_query`) afslørede den egentlige årsag: tabellen
  `calendar_member_mappings` fandtes slet ikke. Migration
  `0004_calendar_member_mappings.sql` var aldrig blevet anvendt på
  beta-databasen. Hverken `npm run build` eller Cloudflare Workers Builds
  kører `wrangler d1 migrations apply` — der findes intet automatisk trin
  nogen steder i pipelinen, der anvender nye migrationsfiler; det kræver en
  manuel kommando, som tydeligvis blev glemt for denne migration. Enhver
  `INSERT`/`SELECT` mod tabellen fejlede derfor med en server-side 500,
  hvilket klientens generiske fejlhåndtering viste som "Kalender-tildelingen
  kunne ikke gemmes" — præcis den samme meddelelse uanset den egentlige
  årsag, hvilket er hvorfor de tre foregående (reelle, men forkerte)
  rettelser aldrig løste symptomet. Rettet ved at anvende migrationen direkte
  på beta (`cd369f99-abc2-44e0-9647-300ee6d85a13`) via
  `d1_database_query`. **Bemærk:** samme opslag viste at
  produktionsdatabasen (`9de10d3f-3178-4b63-838f-0d7377b0df1b`) mangler
  migration 0003 *og* 0004 (hele families/invitations-featuren) — ikke
  akut, da den kode endnu ikke er merget til `main`, men **skal huskes**
  som et manuelt trin, når Fase 2-4 en dag merges til `main`.
  **Proceslæring:** migrationer bør enten anvendes automatisk som en del af
  deploy (fx et build-trin der kører `wrangler d1 migrations apply --remote`
  før/efter `wrangler deploy`), eller som minimum stå som et eksplicit,
  ufravigeligt tjekpunkt i denne plan ved enhver ny migration — en tabel der
  bare ikke findes fejler tavst med en generisk klientfejl, hvilket gjorde
  denne specifikke bug usædvanligt dyr at finde (fire forsøg).

De første tre blev fundet ved at skrive rute-tests, ikke ved manuel
gennemgang — et konsekvent mønster: server-ruter uden automatiserede tests
i denne kodebase har hidtil altid indeholdt mindst én reel bug ved nærmere
eftersyn. Fjerde, femte og sjette krævede rigtig brugertest for at blive
fundet, fordi fejlene sad i klientens tilstandshåndtering (stille
fejlslugning, permanent cache af et fejlet opslag, en effekt der aldrig
kørte for returnerende brugere), ikke i selve serverlogikken — et argument
for også at lægge mærke til `void`-kaldte, ikke-afventede server-skrivninger
uden fejlvisning, og til effekt-betingelser der er optimeret for ét
brugsmønster (første besøg) på bekostning af det langt mere almindelige
(returnerende bruger), ved fremtidige gennemgange.

### Deploy-infrastrukturfejl fundet og rettet (2026-08-13)

`develop`s `wrangler.jsonc` manglede `secrets_store_secrets`-bindingerne for
`GOOGLE_CLIENT_SECRET`/`GOOGLE_TOKEN_ENCRYPTION_KEY`, selvom server-koden
allerede forventer dem (Fase 1). Bindinger sat manuelt i Cloudflare-
dashboardets Bindings-fane overlever ikke et nyt Git-udløst deploy — og
fordi beta auto-deployer ved ethvert push til `develop`, inkl. rene
dokumentations-commits, betød det at Google-login reelt knækkede igen ved
næste deploy, uanset hvad der blev pushet. Nicolaj opdagede dette ved at
tjekke Cloudflare-dashboardet direkte.

Rettet ved at hente den allerede virkende binding-konfiguration fra
`feature/sprint-20-fase2-families` (commit `b1326c0`) ind på `develop`
(commit `e457124`), så fix'en ikke skulle vente på at hele Fase 2 er testet
og merget. Verificeret med `wrangler deploy --dry-run --env beta`.

**Læring:** enhver fremtidig, selv triviel, ændring der pushes til `develop`
trigger et beta-deploy — så deploy-konfiguration (bindinger, secrets) skal
altid stå i `wrangler.jsonc`, aldrig kun sættes manuelt i dashboardet, uanset
hvor lille en anden ændring man laver samme dag.

---

## Konkrete næste skridt, i rækkefølge

1. ~~**Afklar Google-samtykke-status**~~ ✅ Løst — Christine kunne logge ind.
2. ~~**Christine tester Fase 2**~~ ✅ **Gennemført og godkendt (2026-08-14)** —
   PR #29 merget til `develop`.
3. ~~**Rigtig beta-test af Fase 3**~~ ✅ **Gennemført og godkendt (2026-08-14)** —
   PR #28 merget til `develop`.
4. ~~**Gennemgå og test Fase 4**~~ ✅ **Gennemført og merget (2026-08-14)** —
   PR #30 merget til `develop`. Mangler dog stadig rigtig beta-verificering
   af selve UI-flowet (Indstillinger → "Rediger familiemedlem").
5. ~~**Fjern Cloudflare Access**~~ **Besluttet (2026-08-14):** Nicolaj slår den
   fra. Løsrevet fra resten af Fase 6 — ADR-017s egen begrundelse (linje 745)
   satte kun Fase 1-2 som bar, og begge er færdige, merget og testet af to
   rigtige brugere (Nicolaj + Christine). Googles endnu-uverificerede
   samtykke-skærm + invitationskoden er den reelle beskyttelse i mellemtiden.
   Ren dashboard-handling (Zero Trust → Access → Applications) — ingen kode
   involveret, ikke noget en AI-agent kan udføre.
6. ~~**Designvalg + gennemførelse af Fase 5**~~ ✅ **Gennemført (2026-08-15)**:
   Nicolaj valgte "eksportér som backup" over "bulk-opret i Google", men
   bekræftede efterfølgende at der ikke var nogen lokal data at bevare —
   det lokale aftale-lag blev derfor fjernet direkte uden en eksport.
7. **Resten af Fase 6**: ryd op i dødt kode (`GoogleCalendarSession`-
   referencer, `google-calendar-was-connected`), opdatér
   `20_Calendar_Provider_Architecture.md`/`09_Data_Model.md`, bekræft
   Outlook-integrationen fortsat er urørt.

---

## Kendte risici

1. **Googles samtykke-skærm skal formentlig verificeres**, før andre end
   Nicolaj selv kan logge ind uden manuelt at være tilføjet som testbruger i
   Google Cloud Console — kan tage dage-uger. En handling Nicolaj selv skal
   udføre; ikke noget en AI-agent kan gøre. Sandsynligvis den reelle
   blokering for Christines test, uanset kodens tilstand.
2. **Eksisterende Google-forbindelser skal gentvinges**: Google udsteder kun
   en refresh-token ved *første* samtykke pr. bruger+scope, medmindre
   `prompt=consent` tvinges igennem (hvilket koden gør) — alle nuværende
   brugere, inkl. Nicolaj selv, skal derfor logge ind igen under den nye
   flow.
3. **Session-cookiens `Secure`-flag under lokal udvikling** — allerede
   korrekt håndteret i `server/lib/session.ts`s `isSecureRequest()`, som kun
   sætter flaget når requesten reelt kom ind over https. Ingen handling
   nødvendig, nævnt her kun for at bekræfte det er tjekket.
4. D1 i den nuværende skala (få familier) er kapacitetsmæssigt intet
   problem — bevidst overvejet, ikke overset.

---

## Bifangst: Fase 6-indekser allerede tilstede

Den oprindelige plans Fase 6 nævnte tre indekser som udestående arbejde —
alle tre findes allerede i migrationerne, tilføjet undervejs i Fase 1/2 uden
at det var eksplicit planlagt sådan:

- `idx_sessions_user_id` (`0002_auth.sql`)
- `idx_family_memberships_user_id` (`0003_families.sql`)
- `idx_family_members_family_id` (`0003_families.sql`)

---

## Kritiske filer

- `05_App/web/wrangler.jsonc` — fundamentet for hele back-enden (Fase 0).
- `05_App/web/server/routes/calendar.ts` — proxy-laget mod Google (Fase 3).
- `05_App/web/server/routes/families.ts` — familie-/medlemskabs-API'et (Fase 2).
- `05_App/web/src/features/calendar/preferences/familyMembersStorage.ts` —
  formen (`CalendarOwner`, `familyPseudoMemberId`-fallback) D1-endpoints skal
  bevare.
- `05_App/web/src/layouts/AppLayout.tsx` — hvor login- og familie-gates
  sidder, over den eksisterende onboarding-gate.
- `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` —
  ADR-017.

---

## Verifikation pr. fase

- Fase 2: opret familie, generér invitation, accepter den som en anden
  Google-bruger, bekræft rolle-rettigheder (kun admin/ejer kan fjerne
  medlemmer/omdøbe), test ejerskifte. Automatiseret i
  `server/routes/families.test.ts` — mangler stadig en rigtig anden
  Google-konto (Christine).
- Fase 3: forbind Google, opret/redigér/slet en aftale gennem appen, bekræft
  den rammer den rigtige Google-kalender; test at en tilbagekaldt
  Google-adgang giver en tydelig "forbind igen"-besked. Delvist automatiseret
  i `server/routes/calendar.test.ts` — den rigtige Google-kalender-del kan
  kun bekræftes manuelt på beta.
- Fase 5: migrér Nicolajs nuværende lokale aftaler, bekræft de findes korrekt
  i Google Kalender bagefter, inkl. en gentagen aftale.
- `npm run build && npm run lint && npm run test -- --run` skal være grønne
  efter hver fase.

---

## Dokumentets rolle

Opdateres efter hvert fase-skridt (merge, test, bug fundet/rettet) — så
status her altid afspejler den faktiske tilstand på GitHub, ikke en antaget
tilstand fra en tidligere samtale.
