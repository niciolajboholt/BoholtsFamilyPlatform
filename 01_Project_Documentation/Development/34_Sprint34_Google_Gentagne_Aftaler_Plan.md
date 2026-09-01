# 34_Sprint34_Google_Gentagne_Aftaler_Plan

> Status: Fase 1 gennemført; fase 2 (synlighed og redigeringsomfang) til gennemgang

Version: 1.1

Project:
Boholts Family Platform

Last Updated:
2026-09-01

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

Fase 1 var afgrænset til oprettelse. Fase 2 blev sat i gang efter brugerens
praktiske test viste, at "Gentages" var for svært at finde, at almindelige
eksisterende aftaler ikke kunne omdannes til serier, og at valget mellem én
forekomst og hele rækken manglede for Google. Fase 2 gør feltet direkte
synligt ved både oprettelse og redigering af en almindelig aftale og bruger
Googles egen `recurringEventId`/seriemester-model til efterfølgende
redigering og sletning. Selve RRULE-mønsteret på en allerede gentagen serie
ændres fortsat i Google Kalender.

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
4. **Eksisterende RRULE ændres ikke ved redigering.**
   `mapGoogleEventWriteRequest()` udelader fortsat `recurrence` ved PATCH.
   Fase 2 kan derimod målrette enten forekomst-id'et eller den bagvedliggende
   seriemester og opdatere aftalens almindelige felter.
5. **UNTIL formateres forskelligt for heldags- vs. tidsbestemte aftaler**
   — RFC 5545 kræver, at UNTIL's værditype matcher DTSTART's (dato-kun
   for en heldagsaftale, UTC-dato-tid ellers).
6. **Læse-siden bevarer forekomstmodellen gennem inkrementel synk.**
   `singleEvents=true` sendes både ved første hentning og sammen med det
   efterfølgende `syncToken`. Mapperen gemmer kodet seriemester-id og
   `originalStartTime`, så skrivevejen kan målrette korrekt.

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
- Fase 2: `EventRecurrenceSection` flyttes ud af "Flere muligheder".
  En almindelig eksisterende Google-aftale kan få en ny RRULE via PATCH,
  mens Google-forekomster får et "Gælder for"-valg i redigér-dialogen.
  `GoogleCalendarProvider` henter seriemesteren ved hele-rækken-valget og
  anvender forekomstens relative tidsændring på serien. Sletning målretter
  tilsvarende forekomst eller seriemester.
- "Siden sidst"-synkroniseringen bruger samme `singleEvents=true` med
  `syncToken` og grupperer en ny udfoldet serie som én aktivitet.

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
5. [x] ~~Kvalitetskontrol og merge af fase 1.~~ ✅
6. [x] ~~Gør "Gentages" direkte synligt i opret-dialogen.~~ ✅
7. [x] ~~Tilføj Google-valget "Kun denne forekomst"/"Hele rækken" og
   målret korrekt event-id ved redigering/sletning.~~ ✅
8. [x] ~~Ret inkrementel synk og aktivitetsgruppering for gentagelser.~~ ✅
9. [x] ~~Tillad en almindelig eksisterende Google-aftale at blive omdannet
   til en gentagen serie.~~ ✅
10. [ ] Grøn CI og manuel beta-godkendelse af fase 2.

---

## Kendte risici

1. **Kun Google.** Outlook/ICS-brugere ser stadig ikke "Gentages" — samme
   begrænsning som i dag, ikke en regression, men værd at nævne hvis
   familien nogensinde tager Outlook i brug.
2. **Eksisterende seriers gentagelsesmønster redigeres ikke i appen.**
   Brugeren kan vælge om almindelige feltændringer/sletning gælder én
   forekomst eller hele rækken, men ændring af fx ugentlig til månedlig
   foretages fortsat i Google Kalender.
3. **Ingen forhåndsvalidering af Googles egen accept af RRULE'en** ud over
   det, formularen selv sikrer (fx mindst én ugedag) — en sjælden,
   uforudset kombination Google afviser, rammer den allerede
   eksisterende generiske fejlbesked ("Google Kalender afviste aftalens
   data"), ikke en ny fejlvej.

---

## Godkendelse

Godkendt mundtligt ("Jeg tænker vi kører på"). Ingen yderligere
godkendelse afventes før implementering.
