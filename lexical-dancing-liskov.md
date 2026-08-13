# Sprint 20+ — Familie-server: login, flere familier, invitationer

## Context

Appen har hidtil ingen server — alt (familiemedlemmer, lokale aftaler, Google-token) ligger kun i browserens eget lokale lager på ét device (bevidst valg, ADR-011). Det problem stødte vi på direkte: da Nicolaj ville dele linket med Christine, viste det sig at (a) siden er låst bag Cloudflare Access, og (b) selv med adgang ville hun starte helt forfra uden jeres rigtige familie/aftaler, fordi intet er delt.

Beslutningen (bekræftet gennem samtalen) er at bygge en rigtig, **multi-tenant** familie-server, hvor:
- Login sker **udelukkende med Google**, i ét samlet samtykke-trin der giver både identitet og kalender-adgang.
- **Google Kalender forbliver den eneste kilde til selve aftalerne** — vores database gemmer aldrig aftaler, kun familie/bruger/invitations-data. Serveren (ikke hver browser for sig) håndterer fremover Googles OAuth-tokens.
- Enhver familie kan oprette sig selv i den samme kørende app — ikke én installation pr. familie.
- Roller: én **ejer** (kan overdrages, tidligere ejer bliver almindelig admin), flere **admins**, almindelige **medlemmer**. Børn har ingen egen konto endnu — de er kun en profil (navn/farve/relation) knyttet til en forælders Google-kalender.
- **Lokale (ikke-Google) aftaler droppes** — alt skal fremover ligge i en rigtig Google-kalender. Nuværende lokale aftaler migreres én gang.

Cloudflare Workers (allerede platformen) understøtter både statiske filer og server-kode i samme projekt, plus en gratis database (D1) — ADR-013 forudså allerede præcis denne udvidelsesvej. Dette bliver **ADR-017** (den højeste er i dag ADR-016), og den skal eksplicit erstatte ADR-009 (klient-kun Google-flow) og ADR-011 (single-device).

Dette er den største ombygning af appen til dato. Planen er delt i faser, der hver kan afprøves for sig (på `beta`) uden at ødelægge det, Nicolaj bruger dagligt på `main`.

## Fase 0 — Cloudflare/D1-fundament (ingen synlig ændring)

- `05_App/web/wrangler.jsonc`: tilføj `"main": "./server/index.ts"` og en `ASSETS`-binding ved siden af det eksisterende `assets`-blok (Cloudflare understøtter statiske filer + Worker-kode i samme projekt), plus en `d1_databases`-binding. **Separat D1-database for `main` og `env.beta`** — afgørende, så beta-test aldrig kan ødelægge rigtig familiedata.
- Nyt `05_App/web/server/`-modul (Hono som letvægts-router — ingen backend-afhængighed findes i dag, og Hono er lavet til Workers). `@cloudflare/workers-types` + `wrangler` + `hono` tilføjes som dependencies.
- `server/migrations/0001_init.sql` (kørt via `wrangler d1 migrations apply`).
- Én triviel `GET /api/health`-rute (tjekker DB-forbindelse) — hele formålet med denne fase er at bevise at Worker+D1+`wrangler deploy`/`--env beta` virker, før noget rigtigt bygges ovenpå.

## Fase 1 — Google-login (server-side OAuth) + session

- **Google Cloud Console** (Nicolajs egen handling, jeg kan ikke gøre det for ham): tilføj en Authorized redirect URI (`/auth/google/callback`, både prod og beta), gør klienten "confidential" (client secret, gemt som `wrangler secret put GOOGLE_CLIENT_SECRET` — aldrig i `.env`), behold scopes (`calendar.events` + `calendar.calendarlist.readonly`), men brug `access_type=offline&prompt=consent` så der altid følger en refresh-token med.
- Nye ruter: `GET /auth/google/start` (CSRF-state + redirect til Google), `GET /auth/google/callback` (udveksler code → tokens, opretter/finder `users`-række, sætter session), `POST /auth/logout`, `GET /api/me`.
- **Session**: D1-baseret (`sessions`-tabel), opaqe session-id i en `HttpOnly; Secure; SameSite=Lax`-cookie — ikke en JWT, så en session altid kan tilbagekaldes øjeblikkeligt (nødvendigt ved ejerskifte/log ud andre steder).
- Klient: nyt `features/auth/`-modul (`useSession.ts`, `LoginPage.tsx` med "Log ind med Google"-knap der navigerer til `/auth/google/start`). `AppLayout.tsx` får en ny login-gate *over* den eksisterende `hasCompletedFamilySetup()`-gate.
- **ADR-017** skrives i denne fase (dækker hele ombygningen: login, familie-model, server-ejet Google-sync) — erstatter eksplicit ADR-009 og ADR-011.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

## Fase 2 — Familier, medlemskab, invitationer

```sql
CREATE TABLE families (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE family_memberships (
  family_id TEXT NOT NULL REFERENCES families(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (family_id, user_id)
);
CREATE TABLE family_invites (
  code TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL, revoked_at TEXT
);
-- Erstatter familyMembersStorage.ts's CalendarOwner-liste, nu delt pr. familie
CREATE TABLE family_members (
  id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL, color TEXT NOT NULL, relation TEXT,
  is_placeholder_name INTEGER NOT NULL DEFAULT 0,
  linked_user_id TEXT REFERENCES users(id),  -- NULL for børn; sat for voksne der logger ind
  created_at TEXT NOT NULL
);
```
`family_members` bevarer nøjagtigt formen fra dagens `CalendarOwner` (`id, name, color, relation?, isPlaceholderName?`) og `familyPseudoMemberId`-konventionen ("family"-rækken sås ved familie-oprettelse, ligesom `seedMembers()` gør i dag).

- Nye ruter: `POST /api/families` (opret, sår generiske standardnavne — samme som dagens `FamilySetupOnboarding`), `GET /api/families/mine`, `POST /api/invites/:code/accept`, `POST /api/families/:id/invites/regenerate`, `GET|PATCH /api/families/:id`, CRUD på `/api/families/:id/members`, `POST /api/families/:id/memberships/:userId/role`, `POST /api/families/:id/transfer-ownership` (sætter ny ejer + degraderer forrige ejer til admin — matcher den aftalte regel), `DELETE .../memberships/:userId`.
- `familyMembersStorage.ts` bliver API-baseret (samme funktionsnavne hvor muligt, så `useFamilyMembers.ts`, `FamilyMemberDialog.tsx`, `getEventOwnerColor.ts` kræver minimale ændringer — kun sync→async).
- `FamilySetupOnboarding.tsx` forgrenes reelt: "Opret ny familie" vs. "Jeg har en invitationskode".
- Ny `InviteShareDialog.tsx` (kode + regenerér-knap) i Indstillinger; roller vises/administreres samme sted.
- `currentMemberStorage.ts`/`useCurrentMember.ts` bevares som fallback kun til delt-enhed-scenariet (barn bruger forælders allerede-loggede-ind browser) — for en logget-ind voksen kommer "hvem er jeg" fremover fra sessionen via `linked_user_id`.

## Fase 3 — Serveren overtager Google-kalender-synkronisering (ADR-009-vending)

```sql
CREATE TABLE google_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  encrypted_refresh_token TEXT NOT NULL,  -- AES-GCM, nøgle fra en Worker-secret
  scope TEXT NOT NULL, connected_at TEXT NOT NULL, last_refreshed_at TEXT
);
```
- Fase 1's login-flow beder allerede om kalender-scopes (ét samlet samtykke), så `google_connections` sås allerede der — fase 3's reelle arbejde er selve proxy-laget og at flytte eksisterende forbundne brugere væk fra den gamle klient-flow.
- Nye ruter (`server/routes/calendar.ts`), et tyndt autentificeret proxy-lag der spejler `GoogleCalendarApi.ts`'s nuværende metoder: `GET /api/calendar/calendars`, `GET /api/calendar/calendars/:id/events`, `POST/PATCH/DELETE .../events(/:eventId)`. En delt `getGoogleAccessToken(userId)`-hjælper henter en frisk access-token fra refresh-tokenet og håndterer `invalid_grant` (tilbagekaldt adgang) ved at rydde `google_connections` og returnere 401 → UI beder om at forbinde igen.
- **Klient**: `GoogleCalendarApi.ts`'s baseURL ændres fra `https://www.googleapis.com/calendar/v3` til `/api/calendar`, ingen `Authorization`-header længere (cookie-session). `GoogleCalendarSession.ts` (GSI-script, `initTokenClient`, `attemptSilentReconnect`, token-i-hukommelse) **slettes helt** — forbindelsesstatus bliver blot "har brugeren en `google_connections`-række". `useGoogleCalendarConnection.ts` forenkles kraftigt. **`GoogleCalendarProvider.ts`, `googleCalendarMapper.ts`, `googleCalendarWriteMapper.ts`, `googleCalendarIds.ts` — uændrede** (det er præcis gevinsten ved den eksisterende provider-abstraktion). `CompositeCalendarProvider`, alle kalendervisninger (Måned/Uge/Dag/Side by side) — **berøres slet ikke**.

## Fase 4 — Flyt enheds-lokale data der reelt er familie-data

- `calendarMemberMappingStorage.ts` (ADR-014, "denne kalender tilhører Alfred") flyttes til D1, familie-scoped — det er reel delt viden, ikke en enheds-præference:
```sql
CREATE TABLE calendar_member_mappings (
  family_id TEXT NOT NULL REFERENCES families(id),
  google_calendar_id TEXT NOT NULL,
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  PRIMARY KEY (family_id, google_calendar_id)
);
```
- `calendarSourceVisibilityStorage.ts` og `googleCalendarExclusionStorage.ts` **forbliver lokale** — "jeg vil ikke se arbejdskalenderen på min telefon" er en reel enheds-/personpræference, ikke familiedata. Eksplicit skelnen i ADR-017, ikke en stiltiende antagelse.

## Fase 5 — Udfas lokale (ikke-Google) aftaler + engangsmigrering

- Rækkefølge: efter fase 2 (familie skal findes) og fase 3 (Google-skrivning skal virke).
- Ny `LocalEventMigrationDialog.tsx`: viser Nicolajs nuværende lokale aftaler (fra `boholts-family-calendar-events`), tilbyder "Opret i Google Kalender" (bulk via `GoogleCalendarProvider.createEvent`) eller "Eksportér som backup" (genbruger `dataBackupStorage.ts`'s eksisterende `createDataBackup()` direkte — ingen ny eksport-kode nødvendig).
- Gentagne lokale aftaler oversættes til Googles RRULE-format (Google Calendar API understøtter RRULE nativt) — tjek først hvor komplekse Nicolajs nuværende gentagelsesmønstre reelt er, før vi antager en ren oversættelse.
- Slettes: `CalendarService.ts`, `expandRecurringEvents.ts` (+ test), `recurrenceExceptionsStorage.ts` (+ test), `LocalCalendarProvider.ts` (+ test). `CompositeCalendarProvider` mister sin `local`-kilde helt.
- `RecurrenceDialog.tsx`/`EventRecurrenceSection.tsx` bevares, men peger fremover på Googles RRULE i stedet for det lokale gentagelses-system.

## Fase 6 — Oprydning og Cloudflare Access-beslutning

- Fjern dødt: `google-calendar-was-connected`, resterende `GoogleCalendarSession`-referencer.
- **Cloudflare Access bør fjernes**, når app-eget login (fase 1) + invitationssystem (fase 2) er betroet — at have begge er ren friktion (man rammer Access-muren, før man overhovedet ser vores eget login), og Access' identitet kan ikke udtrykke familie-roller. Behold den kun midlertidigt, mens Googles samtykke-skærm stadig er i "Testing"-tilstand (se risiko 1).
- Indekser på `family_memberships(user_id)`, `sessions(user_id)`, `family_members(family_id)`; eksplicit beslutning om hvad der sker med en familie, hvis ejeren aldrig overdrager og bare holder op med at bruge appen (soft-delete, ikke stiltiende).
- Opdatér `20_Calendar_Provider_Architecture.md`/`09_Data_Model.md` til den nye dataflow. Bekræft Outlook-integrationen (fortsat deaktiveret) er fuldstændig urørt af det hele.

## Risici at kende til, før vi går i gang

1. **Googles samtykke-skærm skal formentlig verificeres**, før andre end Nicolaj selv kan logge ind uden manuelt at være tilføjet som testbruger i Google Cloud Console — det tager tid (dage-uger) og bør startes tidligt (fase 1), ikke opdages sent. Dette er en handling Nicolaj selv skal udføre i Google Cloud Console.
2. **Eksisterende Google-forbindelser skal gentvinges**: Google udsteder kun en refresh-token ved *første* samtykke pr. bruger+scope, medmindre `prompt=consent` tvinges igennem — alle nuværende brugere (også Nicolaj selv) skal derfor logge ind igen under den nye flow, ikke kun nye brugere.
3. **Session-cookiens `Secure`-flag under lokal udvikling** (`wrangler dev` kører på almindelig `http://localhost`) — skal gøres miljø-betinget fra start, ikke opdages midt i fase 1.
4. D1 i jeres skala (få familier) er et ikke-problem kapacitetsmæssigt — nævnes kun for at det er bevidst overvejet, ikke overset.

## Kritiske filer

- `05_App/web/wrangler.jsonc` — fundamentet for hele back-enden (fase 0).
- `05_App/web/src/features/calendar/providers/google/GoogleCalendarSession.ts` — slettes (fase 3), viser tydeligst den nuværende arkitektur der vendes.
- `05_App/web/src/features/calendar/providers/google/GoogleCalendarApi.ts` — bliver en tynd proxy-klient i stedet for direkte Google-kald.
- `05_App/web/src/features/calendar/preferences/familyMembersStorage.ts` — formen (`CalendarOwner`, `familyPseudoMemberId`-fallback) nye D1-endpoints skal bevare.
- `05_App/web/src/layouts/AppLayout.tsx` — hvor login- og familie-gates skal ind, over den eksisterende onboarding-gate.
- `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` — ADR-017.

## Verifikation

- Hver fase afprøves selvstændigt på `beta` (egen D1-database) uden at påvirke `main`, ligesom hidtil.
- Fase 0: `GET /api/health` svarer korrekt på både `main`- og `beta`-URL efter deploy.
- Fase 1: fuld login-runde (Google-samtykke → cookie sat → `/api/me` viser brugeren → log ud rydder sessionen).
- Fase 2: opret familie, generér invitation, accepter den som en anden Google-bruger, bekræft rolle-rettigheder (kun admin/ejer kan fjerne medlemmer/omdøbe), test ejerskifte.
- Fase 3: forbind Google, opret/redigér/slet en aftale gennem appen, bekræft den rammer den rigtige Google-kalender; test at en tilbagekaldt Google-adgang giver en tydelig "forbind igen"-besked, ikke en generisk fejl.
- Fase 5: migrér Nicolajs nuværende lokale aftaler, bekræft de findes korrekt i Google Kalender bagefter, inkl. en gentagen aftale.
- `npm run build && npm run lint && npm run test -- --run` skal være grønne efter hver fase, som hidtil.
