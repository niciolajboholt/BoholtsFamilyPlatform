# Google Calendar-provider

Sprint 11.1 implementerer en valgfri, skrivebeskyttet Google Calendar-kilde.
`GoogleCalendarProvider` implementerer den samme `CalendarProvider`-kontrakt
som den lokale provider og oversætter Google-modeller til de
leverandøruafhængige domænetyper, før data når hooks eller UI.

Forbindelsen aktiveres kun med `VITE_GOOGLE_CALENDAR_ENABLED=true` og en
`VITE_GOOGLE_CLIENT_ID` i en lokal `.env`-fil. OAuth-tokenet ligger kun i
hukommelsen og gemmes aldrig i localStorage. Integrationen anmoder kun om
`calendar.readonly`; oprettelse, redigering, sletning og gendannelse af
Google-aftaler afvises af provideren.
## Manuel OAuth-test

1. Opret eller vælg et Google Cloud-projekt, og aktivér Google Calendar API.
2. Konfigurér Google Auth Platform/OAuth consent screen og tilføj testkontoen
   som test user, hvis appen er i testtilstand.
3. Opret en OAuth 2.0 Client ID af typen **Web application** og tilføj den
   aktuelle Vite-origin, eksempelvis `http://localhost:5173`, under
   Authorized JavaScript origins.
4. Opret `05_App/web/.env.local` med
   `VITE_GOOGLE_CALENDAR_ENABLED=true` og
   `VITE_GOOGLE_CLIENT_ID=<client-id>`.
5. Start Vite som normalt og vælg **Forbind Google Kalender** i appen.

Client ID er ikke en hemmelighed, og der bruges hverken client secret,
refresh token eller redirect URI i dette GIS browser token-flow. Access-tokenet
bliver kun i hukommelsen; en genindlæsning kræver derfor normalt en ny
forbindelse. Det eneste scope er
`https://www.googleapis.com/auth/calendar.readonly`.

### Manuel tjekliste

- Før login: lokale aftaler vises, og forbind-knappen vises uden Google-events.
- Login: popup åbner først efter brugerklik og kan afbrydes uden crash.
- Efter login: Google-kilder og -events vises med korrekt farve, tid og
  heldagsdato; Google-events kan åbnes, men ikke redigeres eller slettes.
- Visibility: Google- og lokale kilder kan vises/skjules uafhængigt, mens
  dialogerne fortsat får alle indlæste events til konfliktkontrol.
- Fejl: en Google-fejl vises lokalt, lokale events bliver stående, og retry
  eller genforbindelse virker som angivet i UI'et.
- Logout: Google-sources, -events og fejl fjernes; lokale data og
  visibility-storage bevares.
