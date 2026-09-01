# 34_Sprint34_Google_Gentagne_Aftaler_Plan

> Status: Godkendt ("kører på"), kode i gang

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-31

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Genaktivér muligheden for at oprette en GENTAGENDE aftale direkte mod
Google Kalender fra appens egen "Ny aftale"-dialog — "ligesom en
almindelig aftale", som brugeren bad om. UI'en (`EventRecurrenceSection`/
`RecurrenceDialog`: Aldrig/Hver dag/Hver uge/Hver måned/Hvert år/Tilpas…)
findes allerede fuldt bygget og virkende, men er koblet fra for Google og
alle andre eksterne kalendere (`isExternalCalendarProviderType`) — en
rest fra tiden før Sprint 20 fjernede appens lokale (ikke-Google)
aftale-lag. Skærmbilleder af den eksisterende UI er delt med Nicolaj
separat i chatten.

**Afgrænset til oprettelse af nye aftaler.** At ændre gentagelses­mønsteret
på en ALLEREDE eksisterende Google-serie, eller redigere "kun denne
forekomst" vs. "hele rækken" via appen, er bevidst udenfor scope — det
kræver Googles egen forekomst-model (hver forekomst er sit eget event med
`recurringEventId`), som ikke er det, appens nuværende (nu forældede)
lokale forekomst-undtagelses-mekanisme (`recurrenceExceptionsStorage.ts`)
er bygget til. Naturlig fase 2, hvis fase 1 fungerer godt.

---

## Beslutninger

1. **Kun Google, ikke Outlook/Apple/ICS.** Ny prædikat
   `providerSupportsRecurrenceCreation()` (kun `google`) erstatter
   `isExternalCalendarProviderType()` de tre relevante steder i
   `NewEventDialog.tsx` — resten af den eksterne-kilde-gating (fx
   deltager-sektionen) rører vi ikke. Outlook/ICS mister intet, de har
   aldrig haft det.
2. **Genbruger 100% af den eksisterende UI og form-logik.**
   `EventRecurrenceSection`, `RecurrenceDialog`, `recurrenceFormValueToRule()`
   og `getRecurrenceFormValidationError()` er allerede korrekt bygget.
   `NewEventDialog.tsx` beregner faktisk allerede
   `recurrenceFormValueToRule(recurrence, start)` ved oprettelse — den
   sættes blot eksplicit til `undefined` for eksterne kilder i dag (linje
   ~371-374). Kun den eksplicitte undertrykkelse fjernes for Google.
3. **Ny oversætter: `RecurrenceRule` → Googles `recurrence: string[]`**
   (RFC 5545 RRULE-linjer), tilføjet i
   `googleCalendarWriteMapper.ts`. `RecurrenceRule` er allerede
   struktureret næsten identisk med RRULE'ens felter (frequency/interval/
   byWeekdays/until/count/monthlyPattern/byOrdinalWeekday/byMonthDay) —
   oversættelsen er mekanisk formatering, ikke en ny datamodel.
4. **Kun oprettelses-stien påvirkes.** `mapGoogleEventWriteRequest()`
   tager i dag `CreateCalendarEventInput | WritableEvent` — kun
   førstnævnte har et `recurrence`-felt. Redigering af en eksisterende
   aftale (`WritableEvent`, afledt af `CalendarEvent`) har ingen
   `recurrence`-egenskab at læse, og påvirkes derfor slet ikke af denne
   ændring.
5. **UNTIL formateres forskelligt for heldags- vs. tidsbestemte aftaler**
   — RFC 5545 kræver, at UNTIL's værditype matcher DTSTART's (dato-kun
   for en heldagsaftale, UTC-dato-tid ellers).
6. **Ingen ændring på læse-siden.** Googles egen `recurringEventId`-baserede
   udfoldning (via `singleEvents: true`) er allerede korrekt og uændret —
   denne sprint udvider kun skrive-siden.

---

## Teknisk tilgang

- `src/features/calendar/models/calendarProvider.ts`: ny
  `providerSupportsRecurrenceCreation(providerType): boolean` (kun
  `"google"`).
- `src/features/calendar/components/NewEventDialog.tsx`: erstat
  `isExternalCalendarProviderType(selectedSource?.providerType)` med
  `!providerSupportsRecurrenceCreation(...)` ved (a) render-gaten for
  `EventRecurrenceSection` (~547), (b) validerings-tjekket af
  `recurrenceError` før gem (~321), (c) `recurrence`-feltet i selve
  create-input'et (~371-374, fjerner den betingede `undefined`).
- `src/features/calendar/providers/google/googleCalendarWriteMapper.ts`:
  ny `mapRecurrenceRuleToGoogleRRule(rule, allDay): string[]`. I
  `mapGoogleEventWriteRequest()`: `if ("recurrence" in event && event.recurrence) request.recurrence = mapRecurrenceRuleToGoogleRRule(event.recurrence, event.allDay);`.
- `src/features/calendar/providers/google/googleCalendarTypes.ts`:
  `GoogleCalendarEventRequest` får et nyt `recurrence?: string[]`.
- Tests: ren enhedstest af `mapRecurrenceRuleToGoogleRRule` (alle fire
  frekvenser × alle tre slut-typer, begge månedlige mønstre, heldags vs.
  tidsbestemt UNTIL), udvidelse af `googleCalendarWriteMapper.test.ts`
  (recurrence med i request for et opret-input, fraværende for en
  redigering), og én ny E2E-smoketest der opretter en reelt gentagende
  aftale gennem den rigtige UI og verificerer det udgående
  `recurrence`-felt.

---

## Rækkefølge

1. [x] ~~`providerSupportsRecurrenceCreation()` + de tre gate-opdateringer i
   `NewEventDialog.tsx`.~~ ✅
2. [x] ~~`mapRecurrenceRuleToGoogleRRule()` + enhedstests.~~ ✅
3. [x] ~~Koblet ind i `mapGoogleEventWriteRequest()` + `GoogleCalendarEventRequest.recurrence` + tests (opret vs. redigér).~~ ✅
4. [x] ~~E2E-test: opret en ugentlig gentagende aftale gennem UI'et.~~ ✅
   (Fandt undervejs, at "Gentages" ligger under det kollapsede "Flere
   muligheder"-afsnit — testen åbner det først. Fangede desuden to
   allerede-eksisterende E2E-tests, der var blevet flaky af samme
   dato-drift-årsag som tidligere fikset i denne fil — se Kendte risici.)
5. [ ] Kvalitetskontrol (`lint`, `tsc -b`, `test`, `build`, `test:e2e`) →
   commit → push → PR → grøn CI → merge.

---

## Kendte risici

1. **Kun Google.** Outlook/ICS-brugere ser stadig ikke "Gentages" — samme
   begrænsning som i dag, ikke en regression, men værd at nævne hvis
   familien nogensinde tager Outlook i brug.
2. **Ingen redigering af en eksisterende series gentagelse fra appen** —
   kun oprettelse. Skal ændres, gøres det i selve Google Kalender indtil
   fase 2.
3. **Ingen forhåndsvalidering af Googles egen accept af RRULE'en** ud over
   det, formularen selv sikrer (fx mindst én ugedag) — en sjælden,
   uforudset kombination Google afviser, rammer den allerede
   eksisterende generiske fejlbesked ("Google Kalender afviste aftalens
   data"), ikke en ny fejlvej.

---

## Godkendelse

Godkendt mundtligt ("Jeg tænker vi kører på"). Ingen yderligere
godkendelse afventes før implementering.
