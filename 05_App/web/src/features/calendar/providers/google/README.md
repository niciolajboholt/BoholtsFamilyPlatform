# Google Calendar-provider

`GoogleCalendarProvider` implementerer `CalendarProvider`-kontrakten og
oversætter Google-modeller til appens leverandøruafhængige domænetyper, før
data når hooks eller UI. Selve autentificeringen sker ikke her og ikke i
klienten — se "OAuth-arkitektur" nedenfor.

> **Forældet indhold fjernet (Fase 4, 2026-08-29):** dette dokument beskrev
> tidligere Sprint 11.1's oprindelige klient-kun implicit-flow
> (`VITE_GOOGLE_CALENDAR_ENABLED`/`VITE_GOOGLE_CLIENT_ID` i `.env.local`, et
> browser-popup, intet redirect URI, kun `calendar.readonly`). Den kode
> (`GoogleCalendarSession.ts`) blev fjernet i Fase 3 og erstattet af et
> server-side authorization-code+PKCE-flow (`server/lib/googleOAuth.ts`,
> `server/routes/auth.ts`) — men denne README blev ved et uheld ikke opdateret
> til at følge med, og beskrev derfor en arkitektur der ikke længere findes i
> koden. Erstattet med det faktiske nuværende flow.

## OAuth-arkitektur (nuværende)

Login sker server-side som en almindelig OAuth authorization-code-udveksling
med PKCE, ikke et klient-popup:

1. `GET /auth/google/begin` (`server/routes/auth.ts`) genererer
   state+PKCE-verifier, gemmer dem i en kortlivet, `httpOnly`-cookie og
   omdirigerer til Googles samtykke-skærm.
2. Google sender brugeren tilbage til `GET /auth/google/callback` på samme
   origin, som udveksler koden for et access-/refresh-token
   (`exchangeGoogleAuthorizationCode`), opretter/opdaterer brugeren og
   starter appens egen session.
3. `redirect_uri` udregnes dynamisk som `<indkommende request-origin>/auth/google/callback`
   (`new URL(c.req.url).origin`) — koden er allerede domæneuagtig og kræver
   INGEN ændring for at virke på et nyt miljø. Google validerer dog selv
   `redirect_uri` mod en fast liste i OAuth-klientens indstillinger, så hvert
   faktisk anvendt domæne (lokal dev, beta på `workers.dev`, et fremtidigt
   produktionsdomæne) skal tilføjes under **Authorized redirect URIs** i
   Google Cloud Console — ikke "Authorized JavaScript origins" (det hørte
   til det gamle popup-flow).

Client ID (`GOOGLE_CLIENT_ID`) er en almindelig, ikke-hemmelig Worker-`vars`-
værdi i `wrangler.jsonc`. Client secret (`GOOGLE_CLIENT_SECRET`) er en
Cloudflare Secrets Store-binding, sat i dashboardet — begge server-side,
ingen af dem er klient-`VITE_*`-miljøvariabler, og der findes ikke længere
nogen `.env.local`-opsætning for Google.

## Scopes (verificeret mod koden, Fase 4-review 2026-08-29)

`server/lib/googleOAuth.ts`'s `googleOAuthScopes` anmoder om præcis disse
fem, ingen flere:

| Scope | Hvorfor |
|---|---|
| `openid`, `email`, `profile` | Selve login-identiteten (session/bruger). |
| `https://www.googleapis.com/auth/calendar.events` | Læs/opret/redigér/slet aftaler — appens kalender-CRUD (`server/routes/calendar.ts`s GET/POST/PATCH/DELETE/move på `/calendars/:id/events`) kræver skriveadgang, ikke kun læsning. |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Læs brugerens kalenderliste til kalender-til-medlem-tildeling i Indstillinger (`GET /users/me/calendarList`) — appen opretter/sletter aldrig selve kalendere, kun aftaler, så den bredere `calendar`-scope er bevidst ikke brugt. |

Ingen overflødige scopes fundet — hver anmodet rettighed har et konkret,
verificeret brugssted i koden.

## Manuel OAuth-opsætning (nuværende flow)

1. Opret eller vælg et Google Cloud-projekt, og aktivér Google Calendar API.
2. Konfigurér Google Auth Platform/OAuth consent screen og tilføj testkontoen
   som test user, hvis appen er i testtilstand.
3. Opret (eller genbrug) en OAuth 2.0 Client ID af typen **Web application**.
4. Under **Authorized redirect URIs**, tilføj `<origin>/auth/google/callback`
   for hvert miljø der reelt bruges (fx den lokale `wrangler dev`-origin,
   beta-domænet, og senere et evt. produktionsdomæne) — ikke "Authorized
   JavaScript origins".
5. Sæt `GOOGLE_CLIENT_ID` i `wrangler.jsonc`s `vars`, og `GOOGLE_CLIENT_SECRET`
   som en Cloudflare Secrets Store-binding (se `secrets_store_secrets` i
   samme fil for det eksisterende mønster).

### Manuel tjekliste

- Login: `/auth/google/begin` omdirigerer til Googles samtykke-skærm og kan
  afbrydes uden at appen crasher.
- Efter login: Google-kilder og -events vises med korrekt farve, tid og
  heldagsdato; skrivbare kalendere (`owner`/`writer`) tillader
  opret/redigér/slet, read-only-kalendere kan ses og filtreres, men ikke
  vælges ved oprettelse.
- Visibility: Google- og andre kilder kan vises/skjules uafhængigt, mens
  dialogerne fortsat får alle indlæste events til konfliktkontrol.
- Fejl: en Google-fejl vises lokalt, øvrige kilder bliver stående, og retry
  eller genforbindelse virker som angivet i UI'et.
- Logout: Google-forbindelsen ryddes server-side (`google_connections`);
  se `useSession().logout()` for den fulde oprydningskæde.

## Skriveadgang

Kun calendar-list entries med write-adgang (`owner` eller `writer`) bliver
skrivbare i UI'et. Write-kald bruger `sendUpdates=none`, sender ikke lokale
`ownerIds` som attendees. Update bruger PATCH med kun de felter, appen ejer,
så ukendte Google-eventfelter ikke overskrives. Recurring Google-events er
bevidst ikke skrivbare.
