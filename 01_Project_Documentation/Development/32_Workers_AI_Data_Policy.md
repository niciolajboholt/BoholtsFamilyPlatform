# 32 — Workers AI-datapolitik

> Status: Aktiv · Version 1.0 · Opdateret 2026-08-28

## Formål

Fase 3 i `30_Stabilization_Execution_Plan.md` krævede en præcis dokumentation
af, hvilke felter Cloudflare Workers AI modtager fra appen, og hvor længe de
behandles — før dette var beskrevet kun som den generelle sætning i den
offentlige privatlivspolitik (`LegalPage.tsx`: "relevante aftaletitler, åbne
opgaver og indkøbsvarer kan behandles af Cloudflare Workers AI"). Dette
dokument er den præcise, kodeverificerede udgave. Alle felter nedenfor er
bekræftet direkte i koden (`server/lib/aiAssistant.ts`,
`server/lib/weeklySummary.ts`), ikke antaget.

## Hvor appen bruger Workers AI

Ét eneste sted i koden kalder Workers AI: `runChatCompletion()` i
`server/lib/aiAssistant.ts`, via Workers-bindingen `env.AI.run(model, ...)`.
Bekræftet ved at søge hele servermappen for `env.AI` — der er ingen andre
kaldesteder. Modellen er `@cf/zai-org/glm-4.7-flash`, en gratis-tilgængelig,
Cloudflare-hostet model (ikke en betalingskrævende frontier-model, og ikke et
tredjeparts-API uden for Cloudflares egen infrastruktur).

**Vigtigt:** kaldet går DIREKTE til Workers AI-bindingen, ikke via Cloudflare
AI Gateway. AI Gateway har sin egen, separat konfigurerbare logging, som som
udgangspunkt gemmer selve prompt-/svar-indholdet ved siden af metadata — men
den funktion er kun relevant for trafik, der rent faktisk routes gennem en
gateway. Denne app gør ikke det (ingen `gateway`-id, ingen
`cf-aig-*`-headers i kaldet), så AI Gateways logging-adfærd gælder ikke her.

Der er tre separate brugssteder af denne ene funktion:

### 1. Rutineforslag (`generateRoutineDraft`)

- **Udløses af:** brugeren skriver en fri tekstbeskrivelse af en ønsket
  daglig rutine (fx "morgenrutine for børnene").
- **Sendes til Workers AI:** kun denne selvskrevne beskrivelse — intet fra
  familiens eksisterende data.
- **Svar bruges til:** et udkast (`RoutineDraft`) returneres direkte til
  klienten via `c.json({ draft })` — **gemmes aldrig automatisk** i D1.
  Brugeren skal aktivt gennemgå og gemme rutinen, før den bliver til rigtig
  data (`server/routes/taskRoutes/taskRoutines.ts`).
- **Rate-begrænset:** 429 ved for mange forsøg (samme mønster som øvrige
  skrivehandlinger i appen).

### 2. Ingrediensforslag (`generateIngredientsDraft`)

- **Udløses af:** brugeren skriver navnet på en ret (fx "boller i karry").
- **Sendes til Workers AI:** kun rettens navn.
- **Svar bruges til:** en liste af foreslåede varenavne, returneret direkte
  til klienten — **gemmes aldrig automatisk** på indkøbslisten
  (`server/routes/shoppingListRoutes/items.ts`). Samme rate-begrænsning som
  ovenfor.

### 3. Ugentligt AI-resumé (`generateWeeklySummary`)

Den eneste af de tre, der læser familiens eksisterende data — og den eneste,
hvis output rent faktisk gemmes. Kun aktiv, hvis familien selv har slået
`aiWeeklySummaryEnabled` til (fravalgt som standard, se Fase 3's
"Gennemført"-liste). Kaldes ugentligt af `sendWeeklySummaries()`
(`server/lib/weeklySummary.ts`) for hver familie, der har slået funktionen
til. Sender **udelukkende** disse felter, aldrig andet:

| Kilde | Felter sendt til Workers AI | Felter der ALDRIG sendes |
|---|---|---|
| Kalenderaftaler | `title`, `start` (tidspunkt) | `description`, `location`, deltagere, aftale-id |
| Opgaver | opgavenavn (`name`) | dato, tidspunkt, ikon, hvem der har oprettet den |
| Indkøbsvarer | varenavn (`name`) | kategori, mængde, hvem der har tilføjet den |

**Privatliv er allerede håndhævet, FØR data når Workers AI:**
`collectUpcomingEvents()` henter aftaler via
`fetchPublicFamilyCalendarEvents()`, som kalder `mapEvent()` →
`getSafeGoogleEventDetails()` — den samme redaktionsfunktion, der bruges til
det offentlige delelink og familievisningen. En aftale markeret
`private`/`confidential` har derfor allerede fået sin titel erstattet med
"Optaget", og ingen `description`/`location`, længe før
`generateWeeklySummary()` overhovedet kaldes. Dette er eksplicit
servertestet (se Fase 3's "Gennemført"-liste: "AI-ugeresuméet aldrig
videresender en privat aftales beskrivelse/lokation — selv i en simuleret
situation, hvor aggregationslaget fejlagtigt skulle inkludere dem").

**Output gemmes:** resultatet (ren læsetekst, ikke strukturerede felter — se
kildekommentaren i `aiAssistant.ts`, beslutning 3) skrives til
`family_weekly_summaries`-tabellen i D1 (migration 0012) og sendes som en
pushnotifikation. Dette er appens egen, permanente lagring af et
AI-**output** — ikke noget Workers AI selv gemmer. Et resumé kan ses og
slettes som al anden familiedata; der er ingen separat sletteflow for det i
dag (samme status som resten af familiens D1-data — dækket af det generelle
konto-/dataslet-flow, ikke noget særskilt for AI-output).

## Fejlhåndtering logger ikke selve indholdet

Fejler et Workers AI-kald (fx kapacitetsfejl, timeout), logger
`runChatCompletion()`'s catch-blok kun `logError("Workers AI-kald fejlede",
error)` — det vil sige selve fejlbeskeden fra Cloudflares API (fx
"stream closed" eller en HTTP-statuskode), ALDRIG `systemPrompt` eller
`userPrompt` (som ville indeholde familiens data). Bekræftet direkte i
`structuredLog.ts`'s `logError()`: den logger kun `message`, en eksplicit
`context`-parameter (ikke brugt her) og `error.message` — aldrig
funktionens øvrige lokale variabler.

## Hvor længe data behandles (databehandlingens levetid)

- **Selve inferens-kaldet** (rutine-/ingrediensforslag, og
  ugeresumé-prompten) er stateless fra appens perspektiv: data sendes,
  Workers AI returnerer et svar, og appen har ingen mekanisme til at bede om
  eller modtage nogen form for "historik" fra en tidligere samtale — hvert
  kald er uafhængigt.
- **Cloudflares egen, infrastruktur-interne opbevaring** af selve
  inferens-anmodningen (fx til fejlsøgning/misbrugsforebyggelse på deres
  side) er Cloudflares eget ansvarsområde, styret af deres
  Data Processing Addendum og platformsvilkår — ikke noget denne app
  konfigurerer eller kan slå fra via kode. Dette dokument kan derfor bekræfte
  PRÆCIS hvilke felter appen sender (ovenfor), men ikke en præcis
  opbevaringsperiode i dage/timer på Cloudflares side, uden en aktuel,
  autoritativ kilde. **Ekstern handling:** Nicolaj (eller en fremtidig
  gennemgang) bør verificere den til enhver tid gældende tekst på
  <https://developers.cloudflare.com/workers-ai/platform/data-usage/> — i
  praksis samme kategori ekstern verifikation som Fase 4's
  Google OAuth-gennemgang, ikke noget kodeændringer kan løse.
- **Appens egen lagring** har derimod en klar, verificeret levetid: kun
  ugeresuméets output (ikke input) persisteres, i D1, uden separat TTL —
  følger familiens generelle dataophør (kontosletning).

## Ikke omfattet af dette dokument

- Cloudflares generelle infrastruktur-sikkerhed (netværk, kryptering under
  transport) — dækket af deres platformsdokumentation, ikke appens egen kode.
- En fremtidig chat-baseret AI-assistent eller lignende — findes ikke i
  koden i dag; skal dokumenteres separat, hvis/når den bygges.

## Relaterede filer

- `05_App/web/server/lib/aiAssistant.ts`
- `05_App/web/server/lib/weeklySummary.ts`
- `05_App/web/server/lib/googleCalendarAggregation.ts` (`mapEvent`,
  `getSafeGoogleEventDetails`)
- `05_App/web/server/lib/googleCalendarPrivacy.ts`
- `05_App/web/server/lib/structuredLog.ts`
- `05_App/web/src/pages/LegalPage.tsx` (offentlig privatlivspolicy-tekst)
- `01_Project_Documentation/Development/30_Stabilization_Execution_Plan.md`
  (Fase 3)
