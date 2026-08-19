# 26_Sprint26_Konflikter_Delelink_Plan

> Status: Completed

Version: 1.2

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

Tredje sprint i roadmappen efter det eksterne review (2026-08-18). To
punkter fra den oprindelige, aldrig-implementerede "Fase 2 — MVP"
(`07_Product_Roadmap.md`): kalender-konfliktvisning direkte i
kalendergitteret, og en read-only delelink til familiens kalender for
udenforstående (fx bedsteforældre) uden login.

---

## Beslutninger (godkendt i chat, 2026-08-18)

1. **Konfliktvisning: kun visuel markering, ingen blokering.** Appen har
   allerede konfliktdetektion — men kun midlertidigt, inde i
   opret/redigér-dialogen (`useEventConflicts.ts` +
   `findEventConflicts.ts`, viser en advarsel mens du udfylder formularen).
   Det der mangler, er en **vedvarende** visuel markering direkte i
   kalendervisningen (måned/uge/dag/side-by-side), så en overlappende
   aftale er synlig, når man bare browser kalenderen — ikke kun når man er
   ved at oprette en ny. Ingen bekræftelsesdialog, ingen blokering af
   gemning.
2. **Delelinket viser fulde aftaledetaljer** (titel, tidspunkt, sted,
   beskrivelse) — ikke kun optaget/ledig-blokke. Beslutningen anerkender
   den lavere privatlivsbeskyttelse, hvis linket lækkes; linket kan til
   enhver tid deaktiveres/regenereres (samme mønster som familiens
   invitationskode).
3. **Man vælger hvilke familiemedlemmers kalendere der deles, ikke
   alt-eller-intet.** Rejst af Nicolaj (2026-08-18): et link til
   bedsteforældre bør fx kunne vise kun børnenes kalendere, ikke de
   voksnes. Valget sker pr. familiemedlem (ikke pr. rå Google-kalender) —
   samme begreb som resten af appen allerede taler i
   (`calendar_member_mappings`). Et familiemedlem kan have flere
   Google-kalendere tildelt; vælges medlemmet, følger alle vedkommendes
   kalendere med.
4. **Delelinket bruger ét familiemedlems Google-forbindelse** — den, der
   opretter linket. Appen understøtter i dag ikke flere Google-konti pr.
   familie (se "Flere Google-konti pr. familie",
   `10_Future_Roadmap.md`) — at løse det er en selvstændig, større
   beslutning uden for dette sprints omfang. Delelinket arver derfor
   samme begrænsning som den almindelige kalendervisning i dag: det er
   opretterens Google-kalendere (med familiemedlems-tildeling via
   `calendar_member_mappings`), ikke en aggregering på tværs af flere
   familiemedlemmers separate Google-konti.
5. **Delelinket er skrivebeskyttet og har intet UI for handlinger** — ingen
   opret/redigér/slet, intet login-flow, ingen adgang til andre dele af
   appen. Rent en visning.
6. **Rate-limiting på det offentlige endpoint** (genbruger Sprint 24's
   `checkRateLimit`, nøglet på selve linkets token) — beskytter mod at et
   lækket/misbrugt link kan bruges til at hamre Google Calendar-API'et på
   familiens vegne.
7. **Fast tidsvindue for den offentlige visning** (fx ±1 måned) i stedet
   for appens normale ±1/2 år — det er en "hvad sker der lige nu"-visning
   for en udenforstående, ikke en fuld historisk kalender.

---

## Teknisk tilgang

### Konfliktvisning

- Ny ren funktion `findAllCalendarConflicts(events: CalendarEvent[]):
  Set<string>` i `utils/`, der genbruger samme overlap-/samme-ejer-logik
  som `findEventConflicts.ts` (ikke en ny algoritme — samme regel: to
  aftaler er i konflikt, hvis de deler mindst én `ownerId` og overlapper i
  tid), men parvis over hele det viste sæt i stedet for kun mod ét
  kandidat-udkast.
- Kaldes fra `CalendarPage.tsx` (samme sted `expandRecurringEvents`
  allerede kaldes), resultatet gives videre til måneds-, uge-, dags- og
  side-by-side-visningerne som et sæt konflikt-id'er.
- Visuel markering: en tydelig, men diskret kant/indikator på de berørte
  aftale-elementer (præcis styling afklares under implementering — matcher
  eksisterende `EventSourceBadge.tsx`-mønster for visuelle badges).

### Delelink

- Ny migration: `family_share_links (id TEXT PK, family_id, token TEXT
  UNIQUE, created_by_user_id, included_member_ids TEXT NOT NULL,
  created_at, revoked_at)`. Token er en lang, tilfældig streng (fx 32
  bytes, base64url) — i modsætning til familieinvitationens 8-tegns kode
  (som et menneske taster ind), er dette link beregnet til at blive
  kopieret/delt direkte, så det kan (og bør) være langt nok til at være
  praktisk ugætteligt. `included_member_ids` er en kommasepareret liste af
  `family_members.id` (samme CSV-mønster som `task_routines.weekdays`) —
  de familiemedlemmer, hvis kalendere linket viser.
- Ny, **uautentificeret** rute (uden for `/api/families`s session-krav):
  `GET /api/public/family-calendar/:token`. Slår token op (skal ikke være
  `revoked_at`), henter opretterens Google-kalendere server-side (samme
  krypterede refresh-token-mønster som i dag, `getGoogleAccessToken()`),
  filtrerer til kalendere mappet til et af de valgte medlemmer
  (`calendar_member_mappings` skåret til `included_member_ids` — opslås
  dynamisk ved hvert kald, ikke en statisk snapshot, så en senere ændret
  medlems-tildeling automatisk afspejles), henter aftaler i det faste
  tidsvindue, og returnerer en forenklet, skrivebeskyttet liste (titel,
  tid, sted, beskrivelse, medlemsnavn/-farve) — ingen adgangstoken eller
  andre hemmeligheder eksponeres til klienten.
- `POST /api/families/:id/share-link` (opret/regenerér med et sæt
  `memberIds`, kræver ejer/admin) og `DELETE /api/families/:id/share-link`
  (deaktivér) — samme autorisationsmønster som invitations-regenerering
  (`families.ts`s `/:id/invites/regenerate`).
- Klient: ny offentlig rute `/share/:token` (uden for den almindelige
  login-gate i `AppRouter.tsx`), en minimal skrivebeskyttet kalendervisning.
  **Justeret under implementering**: i stedet for at genbruge de
  eksisterende måned-/ugevisningskomponenter (tæt koblet til
  redigerings-flows, klik-for-at-åbne-dialog osv.) blev det en dedikeret,
  simpel dagsgrupperet agenda-liste — lavere risiko for en offentlig,
  uautentificeret kontekst end at tvinge redigerings-orienterede
  komponenter ind i en read-only-tilstand. Familiens Indstillinger-side får
  en ny "Delelink"-sektion, samme UI-mønster som `InviteCodeCard.tsx`
  (kopiér-knap, deaktivér), plus en afkrydsningsliste over familiemedlemmer
  til at vælge hvem der skal med.

---

## Rækkefølge

1. ~~`findAllCalendarConflicts()` + automatiserede tests, koblet ind i
   `CalendarPage.tsx` og videre til måneds-/uge-/dags-/side-by-side-
   visningerne med en visuel markering~~ ✅ **Gennemført (2026-08-18)**: ny
   `ConflictBadge`-komponent (samme mønster som `EventSourceBadge`) tilføjet
   i alle fem visninger (måned, uge, dag, side-by-side, dagslisten), 7 nye
   tests.
2. ~~Migration: `family_share_links`~~ ✅ **Gennemført**: migration 0010.
3. ~~Server: opret/regenerér/deaktivér-ruter + det offentlige endpoint~~ ✅
   **Gennemført**: `GET/POST/DELETE /api/families/:id/share-link`,
   `GET /api/public/family-calendar/:token` (rate-limitet via Sprint 24's
   `checkRateLimit`), ny `server/lib/googleCalendarAggregation.ts`, 17 nye
   tests.
4. ~~Klient: `/share/:token`-rute + read-only kalendervisning, samt
   "Delelink"-sektionen i Indstillinger~~ ✅ **Gennemført**: se justeringen
   ovenfor (dedikeret agenda-visning i stedet for genbrug af
   måned-/ugekomponenterne).
5. Migration 0010 kørt og verificeret af Nicolaj på både
   `boholtsfamilyplatform` og `boholtsfamilyplatform-beta` (2026-08-18,
   `SELECT name FROM sqlite_master WHERE type = 'table' AND name =
   'family_share_links'` — samme resultat begge steder).
   ~~Manuel test af delelinket~~ ✅ **Bekræftet af Nicolaj (2026-08-19)**:
   "Dele linket virker" — desuden en opfølgende ændring fra agenda-liste
   til en rigtig månedsvisning (samme `MonthCalendar`/`EventList` som
   resten af appen), godkendt samme dag.
   **Resterende, udestår**: den funktionelle manuelle test af
   konfliktmarkeringen på beta/produktion (bekræft den vises korrekt i
   alle fem visninger) — kræver en rigtig browser, ikke noget en
   AI-agent kan udføre alene.
6. ~~Kvalitetskontrol → commit → push → merge~~ ✅ **Gennemført**: 296
   tests, lint/tsc/build grønne.

---

## Kendte risici

1. **Ny uautentificeret offentlig overflade** — første gang appen har et
   endpoint, der bevidst virker uden login. Skal holdes strengt
   skrivebeskyttet, uden nogen sti til at nå autentificerede/skrivende
   ruter fra den offentlige kontekst. Rate-limiting og et langt,
   ugætteligt token er de eneste beskyttelser (ligesom invitationskoden i
   dag, men med et meget større keyspace, da linket ikke tastes manuelt).
2. **Ét familiemedlems Google-forbindelse driver linket** — hvis den
   person senere afbryder sin Google-forbindelse, holder delelinket op med
   at virke (fejler synligt, ikke stille). Accepteret bevidst, jf.
   beslutning 3 — løses først med en fremtidig "flere Google-konti"-ADR.
3. **Konfliktmarkeringen skal gennemføres i fire separate
   visningskomponenter** (måned/uge/dag/side-by-side) — risiko for
   inkonsistent styling eller en glemt visning. Verificeres eksplicit i
   alle fire under manuel test.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.
