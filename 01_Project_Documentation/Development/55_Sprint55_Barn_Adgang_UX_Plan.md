# 55_Sprint55_Barn_Adgang_UX_Plan

Version: 1.0

Project:
Boholts Family Platform (Hjemmecentralen)

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Under implementering 2026-09-19. Fase A, B og D nedenfor implementeres i
dette sprint. Fase C (kalender) implementeres i sit sikre, genbrugte
delomfang — fuld flerpersoners attendee-matching er en dokumenteret,
udskudt arkitekturopgave (se "Fase C — afgrænsning"). Fase E (beskeder)
implementeres som en minimal v1.

---

## Formål

Gøre børneadgangen (Sprint 53) markant lettere at finde, opsætte og
administrere, og udbygge barnets selvstændige "Mit i dag"-visning
(`/barn/:token`) med kalenderaftaler, dansk oplæsning og korte beskeder
fra en voksen — jf. `51_Barnets_Hjemmecentral_Plan.md`s Fase 3 og de
efterfølgende, endnu ikke implementerede punkter derfra.

---

## EXPLORE — konkrete fund

- **`FamilyMemberDialog.tsx`** havde børneadgang som en lille, skjult
  sektion (kun synlig ved at redigere ét medlem ad gangen), med al
  state/handlers duplikeret inline i selve dialogkomponenten. Ingen
  samlet oversigt over, hvilke børn der allerede har et link/en kode.
- **`childAccessManagement.ts`** (Sprint 53) har allerede
  `GET/POST/DELETE .../child-access` og `PUT/DELETE .../child-access/pin`,
  håndhævet server-side via `getMembershipForFamily` (kun ejer/admin) —
  denne autorisation genbruges uændret, UI'et flyttes blot.
- **`child_sessions`**-tabellen (migration 0032) har `id`,
  `family_member_id`, `created_at`, `expires_at` — INGEN "seneste
  aktivitet"-kolonne, og ingen adult-session (`sessions`-tabellen) har det
  heller (ingen eksisterende præcedens at genbruge, kun at følge samme
  minimalistiske stil).
- **`fetchPublicFamilyCalendarEvents`** (`googleCalendarAggregation.ts`,
  Sprint 26, allerede genbrugt af både `publicCalendar.ts` og
  `weeklySummary.ts`) henter allerede Google-aftaler for en liste af
  familiemedlem-id'er, drevet af ÉN voksens gemte token, med indbygget
  privatlivsredigering (`getSafeGoogleEventDetails`: private aftaler →
  "Optaget" uden beskrivelse/lokation) — og lækker ALDRIG selve tokenet.
  Da kaldet sker med `singleEvents=true` mod Googles eget API, er
  gentagne aftaler allerede udfoldet til enkelt-forekomster, og aflyste
  forekomster er allerede filtreret (`status === "cancelled"`) — INGEN ny
  gentagelses- eller udfoldningslogik er nødvendig for dette formål.
- Denne funktion dækker derimod IKKE ægte flerpersoners
  attendee-matching (en aftale i en anden forælders private Google-
  kalender, hvor barnet blot står som deltager) — den logik
  (`matchAttendeesToOwnerIds.ts`) findes kun klient-side, drevet af DEN
  LOGGEDE IND brugers eget browser-hentede token. At udvide den til en
  vilkårlig anden familiemedlems session ville kræve en selvstændig
  arkitekturbeslutning (se "Fase C — afgrænsning").
- **`getCopenhagenDateString`** (`weeklySummary.ts`, allerede genbrugt af
  `familySettings.ts`) giver serveren "dags dato" i dansk tid uden en
  klient at spørge — nødvendigt for børnesessionen, som ikke har en
  browser-lokal dato at sende med, i modsætning til den almindelige
  `/api/families/:id/tasks?date=...`-rute.
- **Ingen** eksisterende besked-/chat-datamodel findes (`activity.ts`
  er kun et beregnet "siden sidst du var her"-overblik, ikke gemte
  beskeder). Ny tabel er nødvendig.
- **Push (`push_subscriptions`)** er nøglet på `user_id` — et barn uden
  konto har intet `user_id` at abonnere med. Kan derfor ikke genbruges
  sikkert til børneadgang uden en ny abonnementsmodel — udelades bevidst
  fra v1, jf. opgavens egen instruks.
- **QR-kode**: ingen eksisterende afhængighed i `package.json`. Valgt
  `qrcode-generator` (npm, kazuhikoarase) — **nul transitive
  afhængigheder**, MIT-licens, senest publiceret august 2025, en af de
  længst etablerede og mest brugte rene QR-matrix-generatorer. Modsat
  fx `qrcode` (som trækker `pngjs`/`yargs`/`dijkstrajs` med, primært til
  Node-CLI-brug) genererer denne kun selve QR-matricen — SVG'en tegnes
  selv, hvilket giver fuld kontrol over farver (matcher MUI-tema) og
  tilgængelighed (eget `role="img"`/`aria-label`, ingen ekstern
  billed-URL).
- **Playwright/CI**: ingen åbne PR'er, `develop` uændret siden sidste
  session (se launch-review-PR #254, allerede merget).

---

## PLAN

### Fase A — Samlet "Børneadgang"-sektion i Indstillinger + QR-kode

**UI:** Ny `ChildAccessSection.tsx` (samme mønster som `FamilySection.tsx`)
i `SettingsPage.tsx`, der åbner `ChildAccessDialog.tsx` (samme mønster som
`FamilyMembershipsDialog.tsx`): lister alle rigtige familiemedlemmer
(`relation !== null`), hver som en udvidelig `Accordion`-række, der viser
status (link/ingen link, kode sat/ikke sat) og rummer alle handlinger
(opret/rotér link, vis QR, kopiér link, sæt/ryd kode, deaktivér).

**Genbrug, ikke dublering:** Al state/logik fra `FamilyMemberDialog.tsx`s
nuværende børneadgangs-sektion udtrækkes til en delt hook
`useChildAccessAdmin(familyId, memberId)`
(`features/family/hooks/useChildAccessAdmin.ts`). `FamilyMemberDialog.tsx`
mister sin egen kopi og får i stedet en enkelt "Administrer
børneadgang"-knap, der åbner `ChildAccessDialog.tsx` forudvalgt på det
medlem, dialogen allerede var åben for — ÉT administrations-flow, ikke to.

**QR-komponent:** `ChildAccessQrCode.tsx` — tegner `qrcode-generator`s
matrix som en inline SVG af `/barn/:token`-URL'en. PIN-koden indgår
ALDRIG i QR-dataene (kun selve linket, nøjagtig samme streng som
"kopiér link"-knappen bruger). En synlig tekstlinje under QR-koden
forklarer eksplicit, at "linket og koden er en adgangsoplysning — del
det kun med barnet selv", og selve link-teksten forbliver læsbar/
kopierbar for skærmlæser-brugere (QR-billedet er et supplement, ikke en
erstatning).

**Ingen server-ændring** ud over det, Fase B tilføjer til samme ruter.

### Fase B — Sessionsoverblik og "Log ud på alle enheder"

**Migration 0033** (se nedenfor): `child_sessions.last_seen_at` — sættes
af `getChildSessionMember()` ved HVERT autentificeret kald (billig,
enkelt `UPDATE`), IKKE ved oprettelse af cookien alene. Ingen IP, ingen
user-agent, ingen fingerprinting — kun to tidsstempler (`created_at`,
`last_seen_at`) pr. session, som allerede foreslået i opgaven som det
mindst mulige.

**Nye ruter** i `childAccessManagement.ts`:
- `GET .../child-access/sessions` — liste af barnets aktive sessioner
  (id, `createdAt`, `lastSeenAt`), ejer/admin-kun.
- `DELETE .../child-access/sessions` — log ud på ALLE enheder for dette
  medlem (sletter alle rækker i `child_sessions` for `family_member_id`).
- `DELETE .../child-access/sessions/:sessionId` — log én enkelt session
  ud.

Rotation/fjernelse af link og fjernelse af PIN rydder allerede (Sprint
53) samtlige sessioner for medlemmet — uændret, nu blot synligt i UI'et.

### Fase C — Kalenderaftaler i børnevisningen (sikkert delomfang)

**Ny rute** `GET /api/child/today/calendar` (samme
`childAccess.ts`-fil, bag den eksisterende `child_session`-middleware):
henter dagens aftaler for barnets EGET kalendermappede medlem-id OG
familiens fælles pseudo-medlem (`relation IS NULL`), via
`fetchPublicFamilyCalendarEvents(env, familyId, family.ownerUserId, [childMemberId, familyPseudoMemberId], range)`
— **den præcis samme funktion**, allerede brugt af den offentlige
delelink og ugeresuméet, ingen ny Google-kalender-kode. `range` udledes
af `getCopenhagenDateString`/en ny `getCopenhagenDayRangeUtc`-hjælper
(tilføjes til `weeklySummary.ts`, samme fil som den allerede eksporterer
`getCopenhagenDateString`).

**Sikkerhed:** intet OAuth-token, ingen iCloud-adgangskode og intet
ICS-link forlader nogensinde serveren — funktionen returnerer kun
færdig-formaterede `{title, start, end, allDay, description?, location?}`,
nøjagtig samme kontrakt som det offentlige delelink allerede har bevist
sikker i produktion siden Sprint 26. Fejler kaldet (fx ejeren har ikke
forbundet Google), vises en blød fejlmelding — opgavevisningen blokeres
ikke.

**Afgrænsning (dokumenteret, ikke implementeret nu):** ægte
flerpersoners aftaler — dvs. en aftale oprettet i FX morens private
Google-kalender, hvor barnet er tilføjet som deltager, men aftalen ikke
ligger i en kalender, der er kortlagt til barnet eller familien — kræver
`matchAttendeesToOwnerIds.ts`s deltager-matchning, som i dag udelukkende
kører klient-side på baggrund af DEN LOGGEDE IND brugers eget,
browser-hentede sæt aftaler (inkl. deltagerlister på tværs af alle
familiens kortlagte kalendere). At tilbyde det samme til en
`child_session` ville kræve enten (a) at køre denne matchning server-side
for en vilkårlig andens kalendere uden brugerens egen sesssion til
stede, hvilket rejser nye spørgsmål om hvor meget af FORÆLDRENES private
kalenderindhold der reelt skal scannes for at finde barnets navn i en
deltagerliste, eller (b) at cache et forhåndsberegnet uddrag, når en
forælder alligevel er logget ind. Begge kræver en selvstændig,
kontrolleret sikkerheds-/privatlivsbeslutning — IKKE en hurtig tilføjelse
her. Dette sprint dækker derfor kun "egne" (kortlagt til barnet selv) og
"fælles familie" (kortlagt til pseudo-medlemmet) aftaler, hvilket dækker
det langt almindeligste tilfælde (en familiekalender + evt. barnets egen
kalender), men ikke den sjældnere "tilføjet som deltager i en andens
private kalender"-situation.

### Fase D — Dansk oplæsning (Web Speech API)

Klient-only, ingen server-ændring. Ny hook
`features/mitIDag/hooks/useSpeechReadout.ts`: bruger
`window.speechSynthesis`/`SpeechSynthesisUtterance`, vælger en dansk
stemme (`lang` starter med `"da"`) hvis tilgængelig, ellers browserens
standardstemme. Bygger oplæsningsteksten UDELUKKENDE fra allerede
klient-side redigerede/tilladte data (samme `nextEvent`/`memberTasks`/
kalenderaftale-objekter, som allerede er hentet og privatlivsredigeret —
aldrig en rå kilde). Knapper: "Læs op"/"Stop"/"Læs op igen", tydelige
`aria-label`er. Stopper ved unmount (cleanup i `useEffect`), ved
`ChildDashboard`s log ud, og ved sidenavigation (samme unmount-effekt).
Ingen automatisk start. Hvis `"speechSynthesis" in window` er falsk,
vises en kort forklaring i stedet for knappen — ingen fejl, ingen
blokering af resten af siden.

### Fase E — Beskeder fra forældre (v1, minimal)

**Migration 0033** (samme fil som Fase B):

```sql
CREATE TABLE child_messages (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX idx_child_messages_member ON child_messages(family_member_id, created_at);
```

**API-kontrakter:**
- `POST /api/families/:id/messages` — enhver logget ind
  familiemedlem (ikke kun ejer/admin — en forælder uden admin-rolle skal
  også kunne skrive en besked) kan oprette en besked til et rigtigt
  medlem i SIN EGEN familie. `body` trimmes, afvises tom, og
  længdebegrænses til 280 tegn (server-side hårdt loft, samme
  "kort besked"-afgrænsning som opgaven selv beder om). Gemmes og vises
  som almindelig, escaped tekst (React) — aldrig `dangerouslySetInnerHTML`,
  ingen HTML-fortolkning nogen steder i kæden.
- `GET /api/families/:id/messages?memberId=X` — enhver familiemedlem kan
  læse et andet medlems beskeder (samme familie-brede synlighedsmodel
  som opgaver/kalender allerede har i appen, jf. privatlivspolitikkens
  "Data gemmes pr. familie"). Markerer IKKE noget som læst (en forælders
  "Se som barn"-forhåndsvisning må ikke fortrænge barnets egen
  læst-kvittering).
- `DELETE /api/families/:id/messages/:messageId` — afsenderen selv ELLER
  ejer/admin kan slette en besked (fortrudt/forkert besked).
- `GET /api/child/messages` — børnesessionens EGNE beskeder, håndhævet
  via `member.id` fra selve sessionen (aldrig et klient-leveret id).
- `POST /api/child/messages/:messageId/read` — markerer én af
  børnesessionens egne beskeder som læst (404, ikke 403, hvis beskeden
  ikke er sessionens egen — samme "afslør ikke eksistensen"-princip som
  `childAccess.ts`s opgave-rute allerede følger).

**Besluttede regler (dokumenteres også i privatlivspolitikken):**
opbevares uden automatisk udløb i v1 (samme som opgaver/beskeder i
resten af appen ikke har en TTL); ingen redigering efter afsendelse
(kun sletning); ingen billeder/filer/links/beskeder mellem børn
indbyrdes; barnet kan IKKE svare i v1.

**UI:** en lille "Besked fra [afsender]"-boks i `MitIDagPage.tsx` og
`ChildAccessPage.tsx`s dashboard (samme visuelle stil, delt
præsentationskomponent), med en "Marker som læst"-knap kun i
børnevisningen. En ny, minimal "Send besked"-dialog i
`FamilyMemberDialog.tsx` eller `ChildAccessDialog.tsx` (afgøres ved
implementering — mest sammenhængende i `ChildAccessDialog.tsx`, da det
allerede er den samlede børneadgangs-side).

---

## Risici

- **Kalender (Fase C):** afhænger af, at familiens ejer har en gyldig
  Google-forbindelse. Samme kendte begrænsning som det eksisterende
  offentlige delelink — fejler blødt, ikke destruktivt.
- **QR-afhængighed:** `qrcode-generator` tilføjes til `package.json` —
  `npm audit`/dependency review kræves før merge (se VERIFY).
- **Migration 0033** rammer to nye/ændrede tabeller i samme fil (samme
  konvention som tidligere migrationer, der grupperer ét sprints
  skemaændringer) — ingen ændring af allerede anvendte migrationsfiler.
- **Live-verifikation** af QR-scanning og oplæsning på en fysisk
  telefon/tablet kan ikke udføres fra denne sandbox (samme kendte
  begrænsning som al tidligere browser-/enhedsverifikation) — markeres
  eksplicit som manuel opfølgning til Nicolaj.

## Ikke besluttet af mig / kræver Nicolajs stillingtagen

- Skal en FORÆLDER (ikke kun ejer/admin) kunne sende en besked til et
  barn, selvom vedkommende er almindeligt "medlem", ikke admin? Antaget
  JA ovenfor (matcher at enhver forælder typisk er en ligeværdig
  omsorgsperson) — ret let at indskrænke til ejer/admin bagefter, hvis
  ønsket.
- Skal beskeder have en opbevaringsgrænse (fx auto-slet efter 30 dage)?
  Antaget NEJ i v1 (ingen ny cron-kompleksitet) — kan tilføjes som en
  selvstændig, lille udvidelse senere.

---

## Teststrategi

- Server: udvidede/nye Vitest-suiter for
  `childAccessManagement.ts` (sessioner), `childAccess.ts` (kalender +
  beskeder), et nyt `childMessages.ts`-modul, og en opdateret
  `accountDeletion.test.ts` (FK-sikkerhed for `child_messages`).
- Klient: unit-test for `useSpeechReadout` (feature-detection, start/
  stop/cleanup med en mock af `window.speechSynthesis`).
- Playwright: nyt scenarie, der dækker hele rejsen fra opgavens
  VERIFY-afsnit (voksen opretter/QR/PIN → barn logger ind → ser
  opgave+aftale+besked → afkrydser opgave → forælder logger alle
  enheder ud → barnets gamle session afvises).

## Roadmap-opdatering

`51_Barnets_Hjemmecentral_Plan.md` opdateres til at markere de punkter,
dette sprint dækker (QR/administration, sessioner, kalender-delmængde,
oplæsning, beskeder v1) som implementeret, med samme eksplicitte
delomfangs-note som ovenfor for kalenderens flerpersoners-begrænsning.
