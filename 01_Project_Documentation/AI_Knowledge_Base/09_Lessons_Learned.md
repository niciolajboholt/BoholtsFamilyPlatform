# 09_Lessons_Learned

> Status: Active

Version: 1.6

Project:
Boholts Family Platform

Last Updated:
2026-08-26 (Sprint 31-opfølgning)

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

## D1-migrationer anvendes ikke automatisk — de skal huskes manuelt hver gang

Fase 4's kalender-tildeling blev "rettet" tre gange (id-oversættelse, `resolveFamilyId`-cache, `AppLayout`-effekt) uden at symptomet forsvandt, fordi ingen af de tre var den reelle årsag: tabellen `calendar_member_mappings` fandtes slet ikke i beta-databasen. Hverken `npm run build`, `npm test` eller Cloudflare Workers Builds kører `wrangler d1 migrations apply` — der er intet trin i pipelinen, der anvender nye migrationsfiler på den faktiske (beta/produktions-)database. Det er en ren manuel kommando, som skal huskes hver gang en ny migrationsfil tilføjes, og som blev glemt her. En manglende tabel fejler tavst med en generisk server-500, som klienten viser som en generisk "kunne ikke gemmes"-fejl — umuligt at skelne fra en rigtig valideringsfejl uden at slå direkte op i databasen.

**Erfaring**: efter enhver ny migrationsfil, bekræft eksplicit (fx via `d1_database_query` mod `sqlite_master`) at tabellen findes i **både** beta- og produktions-databasen, før man antager en Fase er "deployet og klar til test" — "CI er grønt" og "koden er merget" siger intet om databasens faktiske skema. På sigt bør dette automatiseres som et build/deploy-trin i stedet for at være et huske-punkt.

---

## "Migration kørt" fra en bruger er en påstand, ikke en verifikation

Sprint 22 afslørede, at produktions-databasen manglede *hele* familie-datamodellen (`families`, `family_memberships`, `family_members`, `family_invites`, `calendar_member_mappings`) OG migration 0007's ændringer — selvom Nicolaj to gange tidligere havde bekræftet "migration kørt på begge" (både for de oprindelige Fase 4/Sprint 20-migrationer og for 0007), og selvom Claude havde noteret det som fuldført i sprint-planerne. Beta havde hele tiden alle migrationerne korrekt anvendt; kun produktion manglede dem — sandsynligvis fordi migrationerne reelt kun blev kørt mod beta-fanen i D1-konsollen, uden at det blev opdaget.

- **Observation**: Claudes eget D1-forespørgselsværktøj var blokeret ("MCP tool call requires approval") netop i de øjeblikke, hvor en uafhængig verifikation var mest nødvendig — hvilket førte til, at en brugerpåstand blev accepteret og dokumenteret som bekræftet fakta uden selv at kunne tjekkes.
- **Konsekvens**: To sprints' funktionalitet (kalender-tildeling, indkøbslister) var reelt i stykker i produktion i en periode, uden at nogen opdagede det, fordi dokumentationen sagde "gennemført".
- **Fremtidig regel**: Skriv aldrig "bekræftet"/"kørt" i et sprint-dokument alene på baggrund af en brugers besked — enten verificér selv via en direkte databaseforespørgsel (`SELECT type, name, sql FROM sqlite_master ...` er den mest pålidelige, da den viser hele det faktiske skema, ikke kun tabelnavne), eller bed eksplicit brugeren om at køre og indsætte resultatet af netop den forespørgsel, og vent med at opdatere dokumentationen til svaret er set. Hvis værktøjet er blokeret, er "afventer uafhængig verifikation" den ærlige status — ikke "bekræftet".

---

## To parallelle miljøer med samme skema er stadig ét miljø for meget, hvis kun ét bruges

De tre forrige erfaringer ovenfor (manuelle migrationer, "kørt" som påstand frem for verifikation, produktion der i praksis lå ude af sync) var alle symptomer på samme rodårsag: appen kørte to fuldt separate miljøer — et navnløst "produktion" og "beta" — hvor kun beta reelt blev brugt (Nicolaj og Christines installerede PWA peger derhen, og kun beta havde de tre cron-triggers). Produktion levede videre som et helt tomt, glemt duplikat af hele infrastrukturen: egen Worker, egen D1-database, egne migrationer der skulle huskes anvendt to gange i stedet for én.

Ved en gennemgang (26. august, Sprint 31-opfølgning) viste produktions-databasen sig dog ikke at være tom — den indeholdt 1 bruger, 1 familie, 3 opgaver, 1 indkøbsliste, 26 sessioner og 1 Google-forbindelse: rester fra dengang produktion oprindeligt *var* det aktive miljø, før brugsmønsteret skiftede til beta. Nicolaj bekræftede det var hans egen, forældede data — ingen andre kendte til eller brugte den kontoen.

- **Beslutning**: produktions-D1-databasen (`9de10d3f-3178-4b63-838f-0d7377b0df1b`) er slettet permanent. `wrangler.jsonc`'s navnløse miljø har ikke længere en D1-binding og kan derfor ikke skrive rigtig data, selv hvis det ved et uheld bliver deployet til igen. Selve Worker-ressourcen (`boholtsfamilyplatform`) er *ikke* slettet — Cloudflares MCP-værktøjer i denne session havde ingen "slet Worker"-handling, kun "slet D1-database". Den skal fjernes manuelt i Cloudflare-dashboardet, hvis den skal væk helt.
- **Bevidst ikke gjort**: et rigtigt navneskifte (fx at gøre "beta" til det formelle produktionsnavn) — `wrangler.jsonc`'s egen kommentar dokumenterer, at det blev forsøgt og rullet tilbage (2026-08-23), fordi Cloudflares Git-integration er bundet til den eksisterende Worker-ressource, ikke til navnefeltet. Et rigtigt skifte kræver en helt ny Worker med egen URL — hvilket ville ødelægge den allerede installerede PWA på familiens hjemmeskærm. "Beta" forbliver derfor det tekniske navn for det virkelige, eneste miljø fremover.
- **Fremtidig regel**: hold ikke et duplikeret miljø i live "i tilfælde af" — hvis kun ét miljø reelt bruges, skal det andet enten aktivt holdes i sync (dyrt, glemmes i praksis, se lektionerne ovenfor) eller lukkes ned helt. Et halvvejs-eksisterende miljø er værre end intet ekstra miljø: det ser ud som en sikkerhedskopi, men er det ikke, og det akkumulerer stille sin egen, uafhængige data, som ingen husker at tjekke.

**Opfølgning, samme dag**: kort efter sletningen af produktions-D1-databasen begyndte login på beta at fejle med `Cannot read properties of undefined (reading 'prepare')` — `c.env.DB` var pludselig `undefined` i den allerede kørende beta-Worker, selvom `wrangler.jsonc`'s `env.beta`-sektion var fuldstændig urørt, og selvom beta-databasen (`cd369f99-...`) stadig svarede fint på direkte forespørgsler. Bekræftet i Cloudflare-dashboardets Bindings-fane: D1-bindingen var reelt fraværende fra den kørende Workers bindingsliste (kun AI, Assets og de fire secrets stod tilbage). Build-konfigurationen blev tjekket og bekræftet korrekt (`npx wrangler deploy --env beta`, root directory `05_App/web`) — det var ikke en forkert deploy-kommando. Der var heller ikke tale om en cache, der selv rettede sig ved en almindelig ny deploy: en ekstra commit, der rørte `wrangler.jsonc` og udløste en frisk Git-deploy, løste det IKKE alene. Kun en manuel gentilføjelse af D1-bindingen via dashboardets Bindings-fane (samme variabelnavn "DB", samme database) genoprettede login, og det holdt efterfølgende gennem endnu en deploy.

- **Konklusion**: begge miljøer brugte samme bindingsnavn ("DB") under forskellige database-id'er. Mest sandsynlige forklaring: at slette den ene D1-database forstyrrede en allerede-kørende, separat Workers etablerede binding til den ANDEN, stadig gyldige database — en ægte Cloudflare-side uregelmæssighed omkring binding-opløsning ved sletning af en ressource med samme bindingsnavn andetsteds på kontoen, ikke en fejl i wrangler.jsonc, build-kommandoen eller koden.
- **Fremtidig regel**: at slette en Cloudflare-ressource (D1, KV, osv.) er aldrig risikofrit for de andre ressourcer på kontoen, bare fordi de har forskellige id'er — særligt ikke, hvis de deler samme bindingsnavn på tværs af Workers. Efter enhver sletning: bekræft aktivt, at ALLE andre miljøer, der er i brug, stadig virker (fx et rigtigt login-forsøg), i stedet for at antage at kun den slettede ressource er påvirket. Og: hvis en frisk deploy ikke selv retter en forsvundet binding, er dashboardets manuelle "Add binding" et gyldigt, hurtigt nødgreb — selvom det normalt advares imod (forsvinder typisk ved næste Git-deploy), fordi wrangler.jsonc her allerede erklærede den samme binding korrekt, og en efterfølgende deploy derfor blot bekræftede den samme tilstand i stedet for at overskrive den.

---

## Dokumentets rolle

Dette dokument er levende og skal udvides, hver gang et sprint eller en beslutning afslører en konkret, genanvendelig erfaring.
