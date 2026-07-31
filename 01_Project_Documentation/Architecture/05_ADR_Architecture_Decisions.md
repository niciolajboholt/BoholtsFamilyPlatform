# 05 - Architecture Decision Records

**Projekt:** Boholts Family Platform

**Version:** 0.1

---

# ADR-001

## SwiftUI

Beslutning:

Appen udvikles i SwiftUI.

Begrundelse:

Moderne Apple framework med god fremtidssikring.

---

# ADR-002

## MVVM

Beslutning:

Projektet bruger Model View ViewModel arkitektur.

Begrundelse:

Giver bedre struktur og testmuligheder.

---

# ADR-003

## Offline First

Beslutning:

Appen skal fungere uden internet.

---

# ADR-004

## Google Calendar Integration

Beslutning:

Google Calendar er første eksterne integration.

Begrundelse:

Familien bruger allerede eksisterende kalendere.

# ADR-006: Platform Strategy – Apple First

**Status:** Accepted
**Date:** 2026-07-24

## Context

Boholts Family Platform is designed as a long-term family platform for managing shared family activities, including calendar coordination, tasks, planning, information sharing and future integrations.

A strategic decision is required regarding the initial technology platform.

The project needs to balance:

* Development speed
* User experience
* Long-term maintainability
* Access to platform-specific capabilities
* Potential future expansion to additional platforms

The primary expected users are Apple device users, and the best initial experience should therefore be created within the Apple ecosystem.

---

## Decision

Boholts Family Platform will follow an **Apple First development strategy**.

The initial target platforms are:

* iPhone
* iPad
* Future possibility: macOS

The primary technology stack will be:

* Swift
* SwiftUI
* SwiftData
* Xcode
* Apple native frameworks

---

## Architectural Principles

Although the first implementation is Apple-specific, the architecture must maintain clear separation between:

```
User Interface Layer
        |
        |
Business Logic Layer
        |
        |
Data Model Layer
        |
        |
Integration Services
```

The goal is to avoid unnecessary dependency between product logic and the user interface implementation.

This allows future clients or platforms to be added without redesigning the entire system.

---

## Consequences

### Positive

* Native Apple user experience

* Full access to Apple ecosystem capabilities

* Faster initial development

* Direct support for:

  * Apple Calendar integration
  * Notifications
  * Widgets
  * iCloud services
  * Siri integrations
  * Future HomeKit possibilities

* Alignment with existing project decisions:

  * SwiftUI architecture
  * SwiftData database design
  * Xcode project structure

---

### Negative

* Requires Apple development hardware
* Android support will require additional implementation effort
* Some future platform-independent services may require additional abstraction

---

## Alternatives Considered

### Cross-platform development

Examples:

* Flutter
* .NET MAUI
* React Native

Rejected for the initial phase because the project prioritizes the best native Apple experience and already has an Apple-focused architecture.

---

### Native iOS and Android development from day one

Rejected because it increases complexity and delays the first usable version.

---

## Future Android Strategy

Android is not part of the initial development scope.

If Android support becomes relevant, it should be implemented as an additional client application connected to the same underlying platform principles, data model and services.

The strategic decision is therefore:

**Apple First — not Apple Only.**

---

## Related Documents

This decision affects:

* 04_Teknisk_Arkitektur.md
* 09_Data_Model.md
* 11_Google_Calendar_Integration.md
* 13_Xcode_Project_Setup_and_Coding_Standards.md
* 15_Xcode_Projectstruktur_og_Foerste_Implementation.md
* 16_SwiftData_Database_Design.md
* 18_Google_Calendar_Sync_Engine.md

---

# ADR-007: Calendar Provider Abstraction

**Status:** Accepted

**Date:** 2026-07-28

## Context

Kalenderen bruger demo-data og localStorage gennem `CalendarService`. Google Calendar er den første planlagte eksterne integration, og Apple Calendar er en fremtidig mulighed i projektets Apple First-retning. UI-laget må derfor ikke bindes direkte til Google-modeller, OAuth, tokens, calendar IDs eller HTTP-endpoints.

## Decision

Kalenderens dataadgang skal gå gennem det leverandøruafhængige `CalendarProvider`-interface. `LocalCalendarProvider` anvendes først som adapter for den eksisterende `CalendarService`, så lokal/offline funktionalitet, localStorage-data og nuværende UI-kontrakter bevares.

En fremtidig Google- eller Apple-provider skal oversætte sine eksterne data og fejl til samme domænekontrakt, før de når hooks eller React-komponenter.

## Alternatives Considered

### Direkte Google Calendar-integration i UI eller hooks

Afvist, fordi UI så skulle kende Google-specifikke modeller og autentifikation, og fordi lokal data og testdata ville kræve særskilte kodeveje.

### React Context som eneste dependency-injection-mekanisme

Afvist, fordi en eksplicit standardinstans og valgfri provider-parameter i hooken giver den nødvendige testbarhed uden ny global state.

### Omskrivning af den lokale lagring

Afvist, fordi en adapter bevarer den eksisterende storage-key og reducerer risikoen for datatab.

## Consequences

### Positive

* Hooks og UI er uafhængige af konkrete kalenderleverandører.
* LocalCalendarProvider bevarer den nuværende lokale funktionalitet.
* Google Calendar kan tilføjes uden at ændre komponenternes dataadgang.
* Apple Calendar kan implementeres senere bag samme kontrakt.
* Test- og demo-providers kan injiceres uden UI-ændringer.

### Negative

* Provider-laget tilføjer få ekstra filer og en oversættelse omkring den lokale service.
* Leverandørspecifikke muligheder implementeres først, når de kan udtrykkes sikkert i det fælles domæne.
# ADR-008: Google Calendar som skrivebeskyttet, valgfri provider

## Status

Accepteret i Sprint 11.1.

## Kontekst

Familiekalenderen bevarer localStorage som standardkilde, men skal kunne vise
Google Calendar uden at Google-identiteter eller OAuth-detaljer spreder sig til
React-komponenter. Google-aftaler har ikke nødvendigvis en lokal deltager.

## Beslutning

Vi anvender `CompositeCalendarProvider` til at samle lokale og valgfrie
Google-kilder. `CalendarEvent.sourceId` identificerer kalenderkilden, mens
`ownerIds` kun indeholder familiens deltagere. Google bruger namespacede,
URL-encoded source- og event-id'er, læses med `calendar.readonly` og er altid
skrivebeskyttet. OAuth-tokenet er kun i hukommelsen.

## Konsekvenser

Lokale data er fortsat tilgængelige, hvis Google fejler. Eksisterende lokale
events uden `sourceId` normaliseres i hukommelsen fra første ownerId og falder
tilbage til `local:family`. Apple Calendar kan senere tilføjes som endnu en
provider uden Google-afhængigheder i UI'et.
# ADR-009: Google Calendar write access uses provider-routed frontend token flow

## Status

Accepteret i Sprint 12.1.

## Kontekst og beslutning

Familiekalenderen skal kunne ændre events i Google-kalendere, hvor brugeren
har write-adgang, uden at sprede Google-typer eller tokens til UI'et. Vi bruger
de mindst privilegerede scopes `calendar.events` og
`calendar.calendarlist.readonly`. `CompositeCalendarProvider` router writes
via `sourceId`; Google source-permission kommer kun fra CalendarList
`accessRole`.

## Konsekvenser

Tokenet ligger kun i memory, og reload kræver ny brugerinitieret forbindelse.
Der er ingen backend, refresh token eller client secret. Attendees,
recurrence-redigering og vedvarende forbindelse er udskudt. Read-only-kilder
forbliver synlige, men UI og provider afviser write uden netværkskald.

# ADR-010: Platformskifte fra Swift/SwiftUI til React/TypeScript/PWA

## Status

Accepteret i Sprint 13. Formaliserer et skifte, der reelt skete allerede ved
projektstart (2026-07-26), men aldrig blev besluttet eksplicit som en ADR.

## Kontekst

ADR-006 (2026-07-24) besluttede en Apple First-strategi med Swift, SwiftUI,
SwiftData og Xcode som primær teknologistak. Den faktiske implementering, der
blev påbegyndt to dage senere, er i stedet en React 19 + TypeScript-webapp
(Vite, Material UI, PWA). Årsagen er praktisk: udviklingsmaskinen var en
ældre Mac uden adgang til en tilstrækkeligt opdateret Xcode-version til at
understøtte moderne SwiftUI/SwiftData-udvikling. Uden denne beslutning
dokumenteret risikerede vision-, produkt- og arkitekturdokumentation
(baseret på ADR-006) at pege i en anden retning end den faktiske kodebase —
hvilket vi konkret stødte på under AI Knowledge Base-arbejdet i Sprint 12/13.

## Beslutning

Boholts Family Platform udvikles som en **React 19 + TypeScript Progressive
Web App**, ikke en native Swift-app. Dette gælder også fremadrettet, ikke kun
for POC'en.

**Apple First forbliver princippet, men ændrer betydning**: det er en
oplevelsesstrategi (Apple-brugere skal have den bedst mulige oplevelse), ikke
et krav om native Apple-teknologi. PWA'en installeres og fungerer på iPhone/
iPad som på øvrige platforme, og giver dermed en Apple-first-oplevelse uden
en Apple-only teknologistack.

Arkitekturprincippet fra ADR-006 — klar adskillelse mellem UI, forretnings-
logik, datamodel og integrationer — videreføres uændret og er allerede
implementeret via provider-arkitekturen (ADR-007).

## Alternativer overvejet

### Fastholde Swift/SwiftUI og anskaffe nyere Apple-hardware

Afvist for nuværende: ville stoppe udviklingen, mens hardware anskaffes, og
give et rent Apple-only-produkt uden den web/PWA-fleksibilitet, som allerede
er bygget og fungerer.

### Formaliser intet, behold ADR-006 som gældende på papiret

Afvist: efterlader dokumentation og kode i strid med hinanden, hvilket
allerede forvirrede en AI-agent under onboarding (se
`01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`).

## Konsekvenser

### Positivt

* Dokumentation og faktisk kodebase stemmer nu overens.
* Udvikling kan fortsætte uafhængigt af Apple-specifik udviklingshardware.
* PWA'en fungerer allerede på tværs af mobil, tablet og desktop.
* Native Apple-muligheder (widgets, Siri, HomeKit) er ikke opgivet permanent
  — se "Fremtidig Apple-strategi" nedenfor.

### Negativt

* Nogle Apple-specifikke muligheder fra ADR-006 (widgets, Siri, dybe
  HomeKit-integrationer) er ikke tilgængelige via PWA på samme niveau som
  native Swift ville have givet.
* De Swift/SwiftUI/Xcode-specifikke udviklingsdokumenter
  (`01_Project_Documentation/Development/13_Xcode_Project_Setup_and_Coding_Standards.md`,
  `15_Xcode_Projectstruktur_og_Foerste_Implementation.md`,
  `01_Project_Documentation/Architecture/16_SwiftData_Database_Design.md`)
  beskriver nu en ikke-forfulgt retning og bør markeres som historiske eller
  arkiveres i en senere oprydning.

## Fremtidig Apple-strategi

Hvis native Apple-specifikke muligheder (widgets, Apple Watch, dybere
OS-integration) bliver nødvendige, tilføjes de som en supplerende native
klient bag samme provider-arkitektur (ADR-007) — ikke som en genskrivning af
hele platformen. Se `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`,
Fase 3.

## Relaterede dokumenter

Denne beslutning opdaterer den strategiske retning fra ADR-006, men
erstatter den ikke historisk — ADR-006 beskriver stadig, hvorfor Apple First
oprindeligt blev valgt som princip.

* `01_Project_Documentation/AI_Knowledge_Base/04_Project_History.md`
* `01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`
* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`
* `01_Project_Documentation/AI_Knowledge_Base/12_Project_DNA.md`

---

# ADR-011: Single-device forbliver den bevidste model (Audit F-09)

## Status

Accepteret 2026-07-30.

## Kontekst

Den eksterne audit (F-09) pegede på, at appens lokale data og familieprofiler er single-device: der findes ingen login, deling eller synkronisering mellem fx Nicolajs og Christines telefoner. Hvert device har sin egen, uafhængige `localStorage`. Auditens acceptkriterier bad om enten en klar dokumentation af begrænsningen, eller en beslutning om retning mod deling/synkronisering.

## Beslutning

Boholts Family Platform forbliver **bevidst single-device** for nu. Der bygges ikke login, backend eller synkronisering mellem enheder i denne omgang.

Begrundelse: familien bruger i praksis appen fra ét primært device ad gangen (husstandens fælles skærm/telefon), og en flerbruger-løsning kræver en ikke-triviel investering (backend, autentificering, konfliktløsning ved samtidige redigeringer), som ikke står mål med den nuværende brug. At forcere en sync-arkitektur nu ville også låse tidligt bindende valg for F-06/F-11 (datamodel, migration), før det reelle behov er kendt.

## Konsekvenser

### Positivt

* Ingen backend, login eller netværksafhængighed for lokale data — appen forbliver simpel og hurtig at udvikle på.
* F-06 (single source of truth) og F-11 (data-versionering/backup) kan designes til ét device, uden at skulle løse distribuerede konfliktscenarier.

### Negativt

* Familiemedlemmer på forskellige devices ser ikke nødvendigvis samme lokale data (Google Calendar-data er uafhængigt af dette, da det allerede synkroniseres via Google selv).
* En senere overgang til flerbruger vil kræve en ny, selvstændig arkitekturbeslutning og reel udviklingsindsats — ikke en lille tilføjelse.

## Fremtidig retning

Hvis behovet for deling mellem devices opstår, tages en ny ADR, der som minimum skal tage stilling til: autentificering, en backend eller synkroniseringstjeneste, konfliktløsning ved samtidige redigeringer, og migration af eksisterende lokale data. Indtil da er single-device den gældende, dokumenterede grænse — ikke en overset mangel.

## Relaterede dokumenter

* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`

---

# ADR-012: Lokal datamodel — single source of truth og lagringsstrategi (Audit F-06, F-11)

## Status

Accepteret 2026-07-30.

## Kontekst

Auditen (F-06) efterspurgte en dokumenteret, fælles "single source of truth" mellem lokale og Google-events, herunder event-identitet, cache-ejerskab, konfliktpolitik og slette-/tombstone-adfærd. F-11 efterspurgte tilsvarende en dokumenteret lagringsstrategi: skemaversion, migration og backup/restore for `localStorage`-data.

Med single-device bekræftet som gældende model (ADR-011), er de svære, distribuerede dele af disse spørgsmål (konflikt mellem samtidige devices, sync-protokoller) ikke relevante endnu — kun spørgsmålet om, hvordan data er struktureret og ejet inden for ét device.

## Beslutning

**Event-identitet**: hvert `CalendarEvent.id` er unikt inden for sin kilde. Lokale events har et selvgenereret id; Google-events bruger et kodet id (`googleCalendarIds.ts`) afledt af Googles egne kalender- og event-id'er. `sourceId` (fx `local:family`, `google:<kodet-id>`) afgør entydigt, hvilken `CalendarProvider` der ejer et event, og bruges af `CompositeCalendarProvider.getProviderForSource()` til at route skrivninger korrekt.

**Cache-ejerskab**: `CalendarService`/`localStorage` er den eneste persistente kilde for lokale events. Google-events har ingen selvstændig lokal cache — de hentes friskt fra Google ved hvert `getEvents()`-kald og eksisterer kun i React-state (`useCalendarEvents`), så vist data er så aktuel som sidste vellykkede hentning. Der er præcis ét kald til hver af `useCalendarEvents`/`useCalendarSources` (i `CalendarPage.tsx`), så der findes ikke i dag flere, potentielt divergerende cache-instanser.

**Konfliktpolitik**: "sidste skriv vinder" — passende for single-device (ADR-011), hvor der ikke er samtidige skrivere. Google-skrivninger bruger Googles egen `accessRole`/etag-lignende afvisning ved reelle konflikter (fx en aftale ændret et andet sted, håndteret som en almindelig fejl i UI'et), men der er ingen selvstændig, klientside konfliktløsning ud over det.

**Sletning/tombstones**: lokale sletninger er øjeblikkelige og endelige i `localStorage` — der er ikke behov for tombstones, da der ikke synkroniseres mod andre devices (single-device). Google-sletninger går direkte gennem Google API'et og er dermed også øjeblikkelige og autoritative.

**Lagringsstrategi (F-11)**: `localStorage` fastholdes som lagringsteknologi — en overgang til IndexedDB er ikke nødvendig ved den nuværende datamængde (én families kalenderaftaler, familiemedlemmer og indstillinger). Hver lagret nøgle (`calendarEvents`, familiemedlemmer, gentagelsesundtagelser, kalendersynlighed, Google-eksklusion) får et eksplicit skemaversionsfelt, så en fremtidig strukturændring kan migreres deterministisk i stedet for at antage det aktuelle format. Der tilføjes en manuel eksport/import-funktion (backup/restore) i Indstillinger, så data ikke er uigenkaldeligt tabt ved fx en ryddet browser-cache.

## Konsekvenser

### Positivt

* Formaliserer en arkitektur, der reelt allerede eksisterer — ingen destruktiv migration eller ombygning nødvendig.
* Giver et dokumenteret grundlag at bygge skemaversionering og backup/restore på (se implementeringen under F-11).

### Negativt

* `localStorage` har en praktisk størrelsesgrænse (typisk 5-10 MB pr. origin) — hvis datamængden vokser markant (fx flere års aftaler for en stor familie), skal IndexedDB genovervejes. Dette er ikke en aktuel begrænsning.
* Ingen cross-device konsistens, jf. ADR-011 — forventet og accepteret, ikke en fejl i denne beslutning.

## Relaterede dokumenter

* `01_Project_Documentation/AI_Knowledge_Base/10_Future_Roadmap.md`
* ADR-011 (single-device)

---

# ADR-013: Deployment til Cloudflare Pages

## Status

Accepteret 2026-07-30.

## Kontekst

Appen har hidtil udelukkende kørt via `npm run dev` på Nicolajs egen computer. Det betyder i praksis, at familien kun kan bruge appen, når computeren er tændt og udviklingsserveren kører — appen har reelt ingen selvstændig, vedvarende adresse. Dette blev identificeret som en større praktisk begrænsning end oprindeligt antaget: det gør det bl.a. svært at teste en fremtidig "flere Google-konti"-funktion (Christine kan ikke selv forbinde sin konto fra sin egen telefon uafhængigt af Nicolajs maskine).

Appen er en ren klient-side React/Vite-PWA uden backend (jf. ADR-011, single-device) — den kan derfor hostes som statiske filer hvor som helst.

## Beslutning

Appen deployes til **Cloudflare Pages**, forbundet direkte til GitHub-repoet med automatisk deploy ved push til `main`.

Sammenlignet med Vercel/Netlify (de mest almindelige alternativer) har Cloudflare Pages to afgørende fordele for dette projekt:

1. **Ubegrænset båndbredde på gratis-planen** — det højeste skalerbarhedsloft af de sammenlignede muligheder, uden praktisk risiko for at ramme en betalingsmur ved almindelig familiebrug.
2. **Ingen "kun ikke-kommerciel brug"-begrænsning** i vilkårene — Vercels Hobby-plan og Netlifys Starter-plan kræver begge en betalt opgradering, hvis projektet nogensinde bliver kommercielt. Cloudflare Pages' gratis-plan har ikke denne begrænsning, hvilket holder appen fri, uanset hvilken retning projektet tager.

Hvis appen senere får brug for en rigtig backend (fælles database i stedet for per-device `localStorage`, jf. ADR-012, eller brugerkonti), tilbyder Cloudflare Workers/D1/R2 en naturlig udvidelsesvej inden for samme økosystem, uden at skulle migrere hosting-platform.

**Build-konfiguration**:
- Root-mappe: `05_App/web`
- Build-kommando: `npm run build`
- Output-mappe: `dist`
- Miljøvariabler sættes i Cloudflare Pages' dashboard, ikke i repoet: `VITE_GOOGLE_CALENDAR_ENABLED`, `VITE_GOOGLE_CLIENT_ID`.

**SPA-routing**: appen bruger `BrowserRouter` (rigtige URL-stier som `/calendar`, `/settings`, ikke hash-baseret routing). Cloudflares dashboard tilbyder i dag et *Workers*-baseret Git-flow (`npx wrangler deploy`) fremfor det klassiske *Pages*-flow, denne ADR oprindeligt blev skrevet til — begge ender med samme resultat, men konfigureres forskelligt. SPA-fallback håndteres derfor af `not_found_handling: "single-page-application"` i `05_App/web/wrangler.jsonc`, ikke af en `_redirects`-fil: et første forsøg med både `_redirects` og `wrangler.jsonc` samtidig fejlede reelt i produktion ("Infinite loop detected in this rule"), fordi Cloudflares nyere asset-serveringslag opfatter `/* /index.html 200` som en selv-triggerende regel, når `not_found_handling` allerede løser det samme. `_redirects`-filen er derfor fjernet igen.

**Google OAuth**: Google Cloud Console-klientens "Authorized JavaScript origins" skal opdateres til at inkludere den nye production-URL (`https://<projekt>.pages.dev`), ellers fejler Google-login på den deployede adresse. `localhost` forbliver også en gyldig origin, så lokal udvikling er upåvirket.

## Alternativer overvejet

### Vercel

Marginalt mere strømlinet opsætningsoplevelse, men Hobby-planens vilkår om ikke-kommerciel brug gør den til et ringere valg, hvis projektet nogensinde bliver kommercielt — hvilket ikke kan udelukkes på forhånd.

### Netlify

Samme vurdering som Vercel — sammenlignelig funktionalitet, samme begrænsning i de gratis vilkår.

### GitHub Pages

Ingen kommerciel begrænsning, men kræver manuel SPA-routing-håndtering og en selvstændig GitHub Actions-workflow for deploy (i stedet for den indbyggede Git-integration), og har ingen vej til en fremtidig backend, hvis det bliver relevant.

## Konsekvenser

### Positivt

* Familien kan bruge appen fra egne enheder, uden at Nicolajs computer skal være tændt.
* Automatisk deploy ved push til `main` — ingen manuel deploy-proces at vedligeholde.
* Fri for både nuværende og evt. fremtidig kommerciel brug, uden at skulle genoverveje hosting-valget.

### Negativt

* Endnu en ekstern konto/afhængighed (Cloudflare) — dog uden nuværende omkostning.
* Miljøvariabler (Google Client ID) skal holdes i sync mellem `.env.local` (lokal udvikling) og Cloudflare Pages' dashboard (produktion) — ingen automatisk delt kilde.

## Relaterede dokumenter

* ADR-011 (single-device)
* ADR-012 (lokal datamodel)
* `01_Project_Documentation/AI_Knowledge_Base/13_Release_And_Security_Baseline.md`
