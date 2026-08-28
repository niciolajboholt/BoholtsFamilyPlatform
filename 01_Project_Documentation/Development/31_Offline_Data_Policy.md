# 31 — Offline-datapolitik

> Status: Aktiv · Version 1.0 · Opdateret 2026-08-27

## Formål

Fase 8 i `30_Stabilization_Execution_Plan.md` kræver en politik for hvilke
data appen må gemme lokalt til offline-brug, og hvor længe, **før**
IndexedDB/kø-implementeringen påbegyndes. Dette dokument er den politik. Det
er bevidst afgrænset til det, der faktisk skal bygges næste: read-only
offline-visning af allerede hentet data, og en kø til udvalgte
indkøbs-/opgaveændringer. Det designer ikke selve kø-implementeringen eller
konfliktløsningen i detaljer — det sætter rammerne, den skal designes inden
for.

## Nuværende tilstand (før denne politik)

- **App-skal**: Service workeren (`src/sw.ts`) precacher udelukkende
  build-outputtet (JS/CSS/HTML/ikoner) via Workbox' `precacheAndRoute`. Den
  cacher ingen API-svar — hverken læse- eller skriveruter.
- **Kalenderaftaler (læsning)**: Google-provideren gemmer allerede en
  forkastelig lokal cache pr. Google-kalender-id i `localStorage`
  (`googleCalendarSyncCacheStorage.ts`, Sprint 25) — sidst kendte events plus
  Googles `nextSyncToken`, brugt til inkrementel synk. Cachen har ingen TTL
  i dag; den lever, indtil den ryddes eksplicit (ugyldigt syncToken, eller
  logout).
- **Indkøbslister og opgaver**: Ingen lokal persistering i dag. Begge sider
  henter udelukkende fra serveren ved hvert besøg; uden forbindelse virker
  hverken visning eller ændring.
- **Auth/session**: Aldrig cachet. Session er en HttpOnly-cookie, og
  Google-refresh-tokens ligger krypteret i D1 — ingen af delene rører
  service worker-cachen eller `localStorage`.
- **Logout**: `clearAllFamilyStorage()` (kaldt fra `useSession.logout`,
  Sprint 29) rydder al familie-relateret `localStorage`, inkl.
  kalender-sync-cachen, kalender-mappings, synlighed, ekskluderinger og
  gentagelsesundtagelser — samt Outlook/MSAL-sessionen og enhedens
  push-abonnement.

## Politik

### 1. Må aldrig caches lokalt, under nogen omstændigheder

- Session-cookien, OAuth-adgangs-/refresh-tokens, eller noget afledt af dem.
- Rå svar fra `/auth/*`-ruter.
- Andre familiemedlemmers ikke-redigerede private aftaledetaljer — kun den
  allerede server-redigerede "Optaget"-visning (jf. Fase 3's
  privatlivsredaktion) må nogensinde ligge i en klientcache. Redaktionen
  skal være sket, FØR data skrives til cachen — cachen må ikke selv være
  betroet til at redigere ved læsning.

Dette er allerede opfyldt i dag og skal forblive sådan — enhver fremtidig
ændring, der ville bryde dette punkt, kræver en eksplicit ny beslutning, ikke
en stiltiende udvidelse af en eksisterende cache.

### 2. Læsedata: må caches til read-only offline-visning

Kalenderaftaler, indkøbslister/-varer og opgaver/rutiner, som brugeren
allerede har haft serveradgang til at se, må caches lokalt til read-only
visning, når enheden er offline. Reglerne:

- **Kilde til sandhed forbliver serveren.** Cachen er en visningshjælp, ikke
  et nyt datalag — præcis samme princip som den eksisterende
  kalender-sync-cache (Sprint 25) allerede følger, og som Sprint 20 Fase 5
  bevidst fjernede et lokalt aftale-lag for at undgå (ADR-011/012).
- **Alder skal være synlig for brugeren.** Enhver visning af cachet data
  offline skal vise, hvornår data sidst blev hentet fra serveren (fx "Sidst
  opdateret kl. 14:32" eller tilsvarende) — ikke fremstå som live data.
- **TTL: 7 dage.** Data ældre end 7 dage siden sidste vellykkede
  serverhentning vises ikke som cachet fallback — UI'en viser i stedet en
  tom-tilstand med forklaring ("Ingen internetforbindelse, og de gemte data
  er for gamle til at vise"), fremfor at vise potentielt stærkt forældet
  indhold uden brugeren ved det. 7 dage er valgt som "nok til en
  weekend-uden-wifi", ikke som en langtidsopbevaring.
- **Ryddes ved logout**, ligesom den eksisterende kalender-sync-cache.

### 3. Skrivedata: må køes offline for udvalgte, lavrisiko-handlinger

Kun disse handlinger må køes lokalt og afsendes ved genoprettet forbindelse:

- Indkøbsliste: tilføj vare, af-/tilkryds vare, ryd afkrydsede.
- Opgaver: af-/tilkryds opgave.

Disse er valgt, fordi de er append-only eller boolean-toggle — konflikter
har en naturlig, forudsigelig løsning (se nedenfor), og et tabt/duplikeret
forsøg har lav skadevirkning (en vare tilføjes to gange, ikke at en hel
aftale forsvinder).

**Må ikke køes offline i denne omgang** (kræver enten en levende
serverforbindelse i sig selv, eller har en konfliktrisiko der ikke er
triviel nok til at løse med en simpel regel endnu):

- Kalenderaftaler (opret/redigér/slet) — uændret fra i dag.
- Familie-/medlemsadministration, delelinks, roller, ejerskifte.
- AI-baserede forslag (ingrediens-/rutineudkast) — kræver en levende
  Workers AI-forbindelse i sig selv.
- Omdøbning/redigering af eksisterende indkøbsvarer eller opgaver
  (navn/kategori/ikon/tidspunkt) — højere konfliktrisiko end et simpelt
  tilføj/afkryds, og udskydes til en senere iteration.

### 4. Konfliktprincip for køede skrivninger

Køede ændringer afsendes i den rækkefølge, de blev foretaget, ved
genoprettet forbindelse. Hvis en afsendelse fejler, fordi den underliggende
vare/opgave er slettet af et andet familiemedlem i mellemtiden, droppes
netop den køede ændring med en synlig, forståelig besked til brugeren (fx
"Kunne ikke afkrydse 'Mælk' — den er allerede slettet") — ændringen
gen-forsøges ikke automatisk, og resten af køen fortsætter uforstyrret.
Dette er bevidst den simplest mulige regel for det første queue-lag; en mere
raffineret sammenfletning kan tilføjes senere, hvis brugsmønstre viser
behov for det.

## Ikke omfattet af denne politik

- Detaljeret implementering af selve IndexedDB-laget eller kø-mekanikken —
  det er en efterfølgende, separat opgave/PR.
- Automatiske offline-/reconnect-tests — separat "Mangler"-punkt i Fase 8.
- Eventuel fremtidig udvidelse til at også køe redigering/sletning af
  eksisterende indkøbsvarer/opgaver — kræver en ny beslutning, ikke dækket
  her.

## Relaterede filer

- `05_App/web/src/sw.ts`
- `05_App/web/src/features/calendar/preferences/googleCalendarSyncCacheStorage.ts`
- `05_App/web/src/features/auth/hooks/useSession.ts`
- `01_Project_Documentation/Development/30_Stabilization_Execution_Plan.md`
  (Fase 8)
- `01_Project_Documentation/AI_Knowledge_Base/13_Release_And_Security_Baseline.md`
  (Backup, retention og offline)
