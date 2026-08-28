# 29_Sprint29_Sikkerhed_Privatliv_Drift_Plan

> Status: Gennemført

Version: 1.1

Project:
Boholts Family Platform

Last Updated:
2026-08-27 (status rettet — planen blev godkendt og gennemført
2026-08-20, men dokumentet viste stadig "Afventer godkendelse")

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et eksternt review (2026-08-20, af den deployede beta-app og koden på
`main` ved commit `a41ac85`) fandt ingen kritisk autentifikationsfejl,
men flagede en række konkrete privatlivs-, sikkerheds- og driftsfund samt
mindre UX-fejl og dokumentationsdrift. Alle centrale fund i dette sprint
er selvstændigt verificeret direkte mod koden (ikke kun taget for
pålydende) før planen blev skrevet.

**Bevidst udeladt fra dette sprint**: reviewets punkt 1 (miljøstrukturen
beta/produktion). Det er ikke en overset fejl — det er en bevidst
beslutning, taget med Nicolaj i Sprint 28's afrunding, efter det blev
bekræftet at familiens rigtige data og installerede PWA ligger på
"beta", og produktionsmiljøet aldrig er taget i brug. En omlægning
(data-migrering, ny "hvad er den rigtige app"-navngivning) er en
selvstændig beslutning, ikke en kodeændring, og tages separat fra denne
plan.

**Bevidst udeladt**: browser-baserede E2E-tests (Playwright el.lign.) af
login/kalender/delelink/push/cron. Reviewet nævner det som en reel
mangel, men det er en stor selvstændig indsats (test-infrastruktur,
login-simulering) — noteres som en fremtidig kandidat, ikke en del af
dette sprint.

---

## Beslutninger

1. **Fuldstændig logout-oprydning, både lokalt og server-side.**
   `useSession.ts`s `logout()` rydder i dag kun familiemedlemmer og
   "Min profil" — ni andre localStorage-nøgler (Google-eventcache,
   kalender-mappings, kilde-synlighed, Google/Outlook-ekskluderinger,
   gentagelsesundtagelser, Outlook/MSAL-sessionen) overlever et logout.
   Server-side sletter `/auth/logout` kun sessionen, ikke enhedens
   push-abonnement — en udlogget enhed kan derfor blive ved med at
   modtage push om den forrige families kalender/opgaver/indkøbsliste.
   Rettes til: logout rydder al lokal kalender-relateret state, og
   afmelder enhedens push-abonnement (via den eksisterende
   `DELETE /api/push/subscribe`-rute med enhedens aktuelle endpoint, ikke
   ved at slette alle brugerens abonnementer på tværs af devices — en
   bruger kan være logget ind på flere enheder samtidig).

2. **Migrations-synlighed via `/api/health`.** Manuel migration er
   bevidst fastholdt (jf. `09_Lessons_Learned.md` — automatisk kørsel
   uden verifikation var netop det, der gav en tidligere incident), men
   `/api/health` udvides til at rapportere, hvilke forventede
   tabeller/kolonner der rent faktisk findes — et enkelt kald erstatter
   den nuværende manuelle `SELECT name FROM sqlite_master`-ritual og gør
   en mismatch synlig med det samme, i stedet for først når en rute
   fejler i produktion.

3. **Offentlige delelinks: titel/tid som standard, beskrivelse/lokation
   som tilvalg.** `PublicCalendarEvent` inkluderer i dag altid
   beskrivelse og lokation. Migration tilføjer to nye kolonner på
   `family_share_links` (`include_description`, `include_location`,
   begge `DEFAULT 0`) — `ShareLinkCard` får to nye afkrydsningsfelter,
   slået fra som standard. Medlemsnavn beholdes (det er selve pointen
   med et delt kalenderoverblik, og familien har allerede eksplicit
   valgt hvilke medlemmer der deles, i modsætning til beskrivelse/
   lokation som er tilfældigt indhold i den enkelte aftale).

4. **Misbrugsbegrænsning tre steder:**
   - AI-ruterne (rutine-/ingrediensforslag) får en per-bruger rate
     limit, samme `checkRateLimit()`-mønster som invite-accept.
   - `POST /api/push/subscribe` validerer at `endpoint` er en
     `https://`-URL på en kendt push-tjenestes host, før den gemmes —
     uden dette kan enhver logget bruger få Workeren til selv at sende
     signerede, udgående POST-kald til en vilkårlig URL, når en push
     senere afsendes (en reel SSRF-vej).
   - Det offentlige delelinks rate limit nøgles i dag kun på selve
     token'et — én besøgende kan opbruge kvoten for alle andre, der
     kigger på samme link. Nøglen udvides til token+IP, med en grovere
     per-token-grænse som sikkerhedsnet. (Reviewets bekymring om
     ubegrænset D1-rækkevækst fra ugyldige tokens er allerede afgrænset
     af Sprint 24's daglige oprydning — ingen selvstændig rettelse
     nødvendig der.)

5. **Seks mindre, konkrete fejl, rettet i samme omgang:**
   - Ukendte `/api/*`-ruter returnerer appens HTML (200) i stedet for en
     JSON 404 — en catch-all under `/api/*` tilføjes før SPA-fallbacket.
   - Ingen sikkerhedsheaders (CSP, X-Content-Type-Options,
     Referrer-Policy, frame-ancestors) — tilføjes globalt via let
     Hono-middleware.
   - Service workerens `notificationclick` navigerer ikke til
     notifikationens URL, når et vindue allerede er åbent (kun ved et
     nyt vindue) — rettes til at navigere i begge tilfælde.
   - Bundnavigationens `routes`-array mangler helt `/tasks` og
     `/shopping-list`, så begge sider fejlagtigt viser "Overblik" som
     valgt fane. Rettes til intet valgt (ikke en fejlagtig fane), da
     bundnavigationen kun har tre faste destinationer.
   - "Ny aftale" på forsiden navigerer til kalenderen uden at åbne
     opret-dialogen — rettes til at åbne den samme dialog, kalenderens
     egen "Ny aftale"-knap bruger.
   - Ingen global React Error Boundary — en uventet frontend-fejl giver
     i dag en helt tom app. Tilføjes omkring `AppRouter`.

6. **Dokumentationssynkronisering.** `PROJECT_STATUS.md` rettes til de
   faktiske tal (333 tests, Sprint 28 afsluttet, migration 0011
   bekræftet), README udvides med Sprint 25-28, og GitHub issues #9/#20
   gennemgås — afgrænses eller lukkes, hvis deres acceptkriterier
   allerede er opfyldt.

---

## Teknisk tilgang

- Migration 0013: `ALTER TABLE family_share_links ADD COLUMN
  include_description INTEGER NOT NULL DEFAULT 0` og tilsvarende for
  `include_location`.
- `useSession.ts`: ny samlefunktion der rydder alle ni
  localStorage-nøgler (genbruger hver moduls eksisterende
  `clear*()`-funktion, ingen ny lagringslogik). `logout()` kalder desuden
  den eksisterende `usePushNotifications`-afmeldingslogik, hvis en
  aktiv subscription findes på enheden.
- `/auth/logout`: udvides til at slette enhedens `push_subscriptions`-
  række via det medsendte endpoint (klienten sender det i logout-kaldet,
  som den allerede gør ved eksplicit afmelding i Indstillinger).
- `/api/health`: udvides med en liste over forventede
  tabeller/nøglekolonner, slået op via `sqlite_master`, i samme svar som
  det eksisterende `db: true/false`.
- AI-ruternes rate limit og push-endpoint-validering følger nøjagtig
  samme mønster som `rateLimit.ts`/`invite-accept` allerede bruger —
  ingen ny infrastruktur.
- Sikkerhedsheaders og `/api/*`-404-fallback tilføjes som Hono-
  middleware i `index.ts`, før de eksisterende ruter.

---

## Rækkefølge

1. Migration 0013 + delelink-tilvalg (server + `ShareLinkCard`-UI).
2. Fuldstændig logout-oprydning (klient + server-side push-afmelding).
3. `/api/health`-udvidelse med migrations-synlighed.
4. Misbrugsbegrænsning: AI-rate-limit, push-endpoint-validering,
   delelinks rate-limit-nøgle.
5. De seks mindre fejl (404-fallback, sikkerhedsheaders,
   notification-klik-navigation, bundnav, "Ny aftale"-dialog, Error
   Boundary).
6. Dokumentationssynkronisering (PROJECT_STATUS.md, README, issues
   #9/#20).
7. Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`) → commit → push →
   verificér grøn CI + begge Workers Builds → merge `develop` til
   `main`, løbende for hvert punkt (samme granulære arbejdsgang som
   resten af sessionen), ikke som én stor samlet ændring.

---

## Kendte risici

1. **Push-endpoint-validering kan ramme legitime, men ukendte
   push-tjenester** — en for stram allowlist kunne i teorien afvise en
   browser/push-tjeneste, jeg ikke kender til. Løses med en bred, men
   ikke ligegyldig regel (kræv `https://`, afvis `localhost`/private
   IP'er/interne hostnavne), ikke en snæver eksplicit liste over kendte
   udbydere.
2. **Bundnav-rettelsen ændrer synligt UI** (ingen fane markeret på
   Opgaver/Indkøbsliste-siderne, i stedet for den nuværende forkerte
   "Overblik") — en bevidst adfærdsændring, ikke kun en bugfix, værd at
   være opmærksom på ved test.
3. **"Ny aftale"-dialogen kræver at CalendarPage kan åbnes i en
   "opret straks"-tilstand** — afhænger af hvordan CalendarPage allerede
   styrer sin egen opret-dialog; teknikken (URL-param vs. delt
   tilstand) afklares under implementering.

---

## Godkendelse

Intet arbejde påbegyndes, før Nicolaj har godkendt denne plan — herunder
specifikt beslutningerne ovenfor. Godkend ved at sige til i chatten.

**Godkendt og gennemført 2026-08-20**, i rækkefølgen beskrevet ovenfor:

| Rækkefølge | Indhold | PR |
|---|---|---|
| 1 | Delelinks: titel/tid som standard | [#75](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/75) |
| 2 | Fuldstændig logout-oprydning | [#76](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/76) |
| 3 | `/api/health` udvidet med migrations-synlighed | [#77](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/77) |
| 4 | Misbrugsbegrænsning (AI, push-endpoint, delelinks) | [#78](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/78) |
| 5 | Seks mindre fejl | [#79](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/79) |
| 6 | Dokumentationssynkronisering | [#80](https://github.com/niciolajboholt/BoholtsFamilyPlatform/pull/80) |
