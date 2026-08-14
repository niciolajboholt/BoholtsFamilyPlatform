# 09_Lessons_Learned

> Status: Active

Version: 1.3

Project:
Boholts Family Platform

Last Updated:
2026-08-14 (Sprint 20, Fase 0-4)

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Dette dokument opsamler konkrete erfaringer fra projektets forløb, så samme problemer ikke gentages.

---

## Strategisk retning skal formaliseres, når den ændrer sig

Projektet blev besluttet som Apple-first (ADR-006) med Swift/SwiftUI/SwiftData/Xcode. Den faktiske implementering blev React/TypeScript/PWA, fordi udviklingsmaskinen (en ældre Mac) ikke havde adgang til en tilstrækkeligt opdateret Xcode-version. PWA gjorde det praktisk muligt at fortsætte Apple-first-retningen (bedst mulige oplevelse for Apple-brugere) uden at være afhængig af native Apple-udviklingsværktøjer.

- **Observation**: Et teknisk vilkår (adgang til udviklingsmaskine/værktøjer) tvang en teknologibeslutning, som aldrig blev formaliseret som ADR.
- **Konsekvens**: Vision-, produkt- og arkitekturdokumenter forblev Swift-baserede, mens koden blev React-baseret — en stille uoverensstemmelse, der først blev opdaget ved en efterfølgende gennemgang.
- **Fremtidig regel**: Når et praktisk vilkår tvinger et teknologiskifte, skal det besluttes og dokumenteres eksplicit som en ny eller opdateret ADR samme sprint — ikke efterlades som en implicit afvigelse. Se [04_Project_History](04_Project_History.md) og [12_Project_DNA](12_Project_DNA.md).
- **Opfølgning (Sprint 13)**: Skiftet er nu formaliseret som ADR-010. Reglen ovenfor er dermed selv fulgt, blot to sprints forsinket i stedet for samme sprint — hvilket bekræfter, hvorfor reglen er værd at holde fast i fremover.

---

## Provider-abstraktion betaler sig tidligt

Ved at indføre `CalendarProvider`-kontrakten (ADR-007) *før* Google Calendar-integrationen blev tilføjet, kunne Google- og senere Apple-integrationer bygges uden at ændre UI-laget.

**Erfaring**: Leverandøruafhængige kontrakter er billigst at indføre, før den anden leverandør kommer til — ikke som en efterfølgende omskrivning.

---

## Mindst mulige rettigheder som fast praksis

Både den skrivebeskyttede (ADR-008) og skrivende (ADR-009) Google-integration blev bygget med de snævrest mulige OAuth-scopes og uden persistent token-lagring.

**Erfaring**: Denne praksis bør fastholdes for alle fremtidige integrationer (Apple Calendar, Outlook m.fl.), også når det er fristende at bede om bredere adgang for at spare tid senere.

---

## Manglende testdækning er en aktiv risiko

Der findes i dag ingen automatiseret test (unit, integration eller UI), selvom Release Plan (`Development/19_Release_Plan.md`) forudsætter en fuld teststrategi før release.

**Erfaring**: Testdækning bør indføres løbende med ny funktionalitet, ikke eftermonteres lige før en release. Se [08_Development_Standards](08_Development_Standards.md) og [10_Future_Roadmap](10_Future_Roadmap.md).

**Opfølgning (Sprint 13)**: Vitest er nu indført, og de rene Google-mapper-funktioner (hvor de to tidszone-fejl fra Sprint 12.1 lå) har automatiseret regressionsdækning, inkl. en test der aktivt bekræfter, at fejlen ville blive fanget igen, hvis den blev genindført. React-komponenter og hooks har fortsat ingen automatiseret test — kun manuel test.

---

## Dokumentationsstruktur skal vedligeholdes aktivt

Flere dokumenter i denne Knowledge Base blev oprettet som tomme skabeloner ("(Tom sektion)") og forblev det i flere sprints, indtil de blev udfyldt retroaktivt. Dokumentation blev desuden tilføjet direkte via GitHub web-upload i stedet for via almindelige commits i nogle tilfælde.

**Erfaring**: Skabelon-dokumenter bør udfyldes samme sprint, de oprettes, eller markeres tydeligt som ventende — ellers mister Knowledge Base sin værdi som "projektets langsigtede hukommelse" (jf. [00_README](00_README.md)).

---

## OneDrive og Git kan komme i konflikt

Projektmappen synkroniseres via OneDrive. Det har ved flere lejligheder ført til, at OneDrive har låst mapper og filer, mens Git forsøgte at ændre dem, samt at untracked mapper har blokeret branch-skift.

- **Observation**: OneDrive-synkronisering og Git-operationer (checkout, branch-skift) kan komme i vejen for hinanden i denne projektmappe.
- **Konsekvens**: Branch-skift og andre Git-operationer kan fejle eller opføre sig uventet, uden at årsagen er en fejl i selve Git-historikken.
- **Fremtidig regel**: Ved uventede Git-fejl i denne mappe, mistænk først OneDrive-lås eller untracked filer/mapper, før der konkluderes noget om selve repoets tilstand. Sørg for at OneDrive har synkroniseret færdigt før større Git-operationer.

---

## Lokale og remote branches kan divergere ubemærket

Flere gange er lokale branches (fx `develop`) og deres remote-modstykke (`origin/develop`) fundet i forskellig tilstand, uden at det var tydeligt for den, der arbejdede i repoet.

- **Observation**: Lokal og remote branch-tilstand er ikke altid identisk, og en agent kan fejlagtigt antage, at lokal `HEAD` afspejler den nyeste fælles status.
- **Konsekvens**: Arbejde kan risikere at basere sig på forældet eller divergeret grundlag, og en påstået commit eller merge skal derfor altid verificeres direkte i Git, ikke antages ud fra en tidligere samtale eller rapport.
- **Fremtidig regel**: Kør `git fetch` og sammenlign lokal branch mod `origin/<branch>` ved sessionens start, og igen før en branch antages "up to date". Stash er en midlertidig arbejdshjælp, ikke en erstatning for commit og versionsstyring.

---

## Cloudflare Worker-bindinger skal stå i wrangler.jsonc, aldrig kun i dashboardet

Under Sprint 20 (server-fundamentet, Fase 0-1) blev timevis brugt på at fejlsøge et "invalid_client"-login, der viste sig at skyldes at `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` var sat i Cloudflare-dashboardets **Settings → Build → "Variables and secrets"** — en sektion der kun gælder selve build-trinnet, aldrig den kørende Workers runtime. Det rigtige sted er **Bindings-fanens Secrets Store**. Samme fejlklasse ramte senere igen (2026-08-13): en binding sat korrekt via dashboardet forsvandt ved næste Git-udløste deploy, fordi den ikke også stod i `wrangler.jsonc`.

- **Observation**: Cloudflare har flere steder, der ligner hinanden, men opfører sig forskelligt (build-tids-variabler vs. runtime-bindinger; dashboard-sat vs. config-pinnet).
- **Konsekvens**: En binding kan virke i én deployment og forsvinde stille i den næste, uden nogen fejlbesked ud over en runtime-fejl langt fra årsagen (fx `Cannot read properties of undefined (reading 'get')`).
- **Fremtidig regel**: Enhver runtime-binding (D1, Secrets Store, `vars`) skal stå eksplicit i `wrangler.jsonc` for både `main`- og `env.beta`-blokken. Dashboard-ændringer er kun en midlertidig test, aldrig den endelige kilde.

---

## Ethvert push til `develop` deployer til beta — også rene dokumentations-commits

Cloudflares Git-integration bygger og deployer ved hvert push til den branch, der er sat som "Production branch" for `boholtsfamilyplatform-beta` (`develop`) — uanset om ændringen rører appkoden. En docs-only-commit i dag udløste et helt nyt deploy, som (fordi en tidligere binding-rettelse endnu ikke var pinnet i config) reelt nulstillede login på beta.

**Erfaring**: Behandl `develop` som en levende, altid-deployet branch. Deploy-kritisk konfiguration (bindinger, secrets) skal være korrekt i `wrangler.jsonc` *før* enhver anden ændring pushes samme dag — den behøver ikke være relateret til det, man rent faktisk arbejder på, for at udløse et deploy.

---

## Globale primærnøgler på tværs af "tenants" kræver eksplicit scoping-tjek

Sprint 20 gjorde appen multi-tenant (flere familier i samme database). Tre separate bugs (Fase 2, Fase 4 ×2) opstod, fordi et id-baseret tjek, der var korrekt i den gamle single-tenant/lokale model, ikke automatisk blev opdateret til at være familie-scoped i den nye:

1. Sletning af "Familien"-pseudomedlemmet tjekkede `id != 'family'` — men id'er er nu `crypto.randomUUID()`, ikke faste slugs (kan ikke være faste, da `family_members.id` er en global primærnøgle).
2. Tildeling af en kalender til et familiemedlem validerede ikke at det angivne medlem-id faktisk tilhørte den familie, der lavede kaldet — en admin kunne i praksis pege på et medlem fra en helt anden familie.
3. Klientens lokale "Familien"-id (`"family"`, en fast konstant fra før multi-tenant) blev sendt direkte til serveren som om det var et rigtigt medlem-id, og blev korrekt afvist af tjek nr. 2 — men fejlen blev aldrig vist, fordi kaldet var `void` uden fejlhåndtering.

**Fremtidig regel**: Når en tabel/entitet får en global (ikke længere unik-pr.-ejer) primærnøgle, skal *enhver* eksisterende sammenligning mod den nøgle (lighed, ulighed, "tilhører dette"-tjek) gennemgås eksplicit — antag ikke at et gammelt tjek stadig er korrekt bare fordi typen (streng) er uændret. Og: server-skrivninger fra UI'et bør altid have en fejl-sti, selv en simpel — et `void`-kaldt, ikke-afventet API-kald skjuler enhver serverafvisning fuldstændigt for brugeren.

---

## Rute-tests finder bugs, manuel gennemgang overser dem

Alle fire ovenstående server-bugs (Fase 2's slettebeskyttelse, Fase 3's 204-krasj, Fase 4's cross-family-validering, og den stille "Familien"-fejl) blev fundet ved at skrive automatiserede rute-tests for kode, der allerede var merget uden nogen — heller ikke Fase 4's cross-family-bug, som først blev fanget under en systematisk gennemgang, ikke ved første øjekast.

**Erfaring**: En server-rute uden automatiseret test i denne kodebase har hidtil *altid* indeholdt mindst én reel bug, når den blev testet efterfølgende. Ny server-kode bør have rute-tests, før den merges — ikke eftermonteres, hvis det kan undgås.

---

## Dokumentets rolle

Dette dokument er levende og skal udvides, hver gang et sprint eller en beslutning afslører en konkret, genanvendelig erfaring.
