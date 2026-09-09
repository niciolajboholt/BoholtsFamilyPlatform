# 36_Sprint36_Manuelt_Ejerskab_Google_Plan

> Status: Implementeret, afventer grøn CI og beta-godkendelse

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-03

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et familiemedlem uden egen konto/kalender (fx et barn, "Alfred") kan i dag
slet ikke få sine Google-aftaler korrekt tilknyttet: appen kender kun to
veje til ejerskab på en Google-aftale — deltager-e-mail-match eller
kalender-til-medlem-tildeling (se `matchAttendeesToOwnerIds.ts`) — og
ingen af dem virker for et medlem uden egen e-mail, hvis aftaler i øvrigt
ligger på en delt/forælders kalender. Symptomet var todelt: ingen farvet
cirkel med forbogstav i månedsvisningen for det medlem, og intet navn på
aftalekortet i dagslisten.

Løsningen er en tredje, manuel vej: i redigér- (og opret-) dialogen kan et
Google-aftales ejerkreds nu sættes direkte, ligesom det allerede var muligt
for interne aftaler. Overstyringen gemmes i Googles egen
`extendedProperties` på selve aftalen — ikke i en ny tabel i vores egen
database — så den automatisk deles mellem alle familiens enheder, samme
sted alle andre aftaledata i forvejen hentes fra.

---

## Beslutninger

1. **Gemmes i Googles extendedProperties, ikke en ny D1-tabel.** Da appen
   allerede har skriveadgang til aftalen (redigering kræver det), og
   `extendedProperties.private` er Googles egen, dokumenterede mekanisme
   til app-privat metadata på en aftale. Undgår en helt ny synkroniserings-
   vej (migration, server-route, klient-cache) for noget, der allerede
   flyder gennem den eksisterende Google-synk.
2. **Overstyringen går forud for BÅDE deltager-match og kalender-
   tildeling.** Det er et eksplicit, bevidst valg fra brugeren — ikke et
   gæt appen selv har lavet.
3. **Kun skrevet, når brugeren faktisk har rørt ejerkredsen i denne
   redigering** (`ownerIdsChanged`, sammenlignet mod formularens
   startværdi) — ellers ville enhver redigering af en Google-aftale (selv
   en titelrettelse) utilsigtet fastfryse det automatisk matchede ejerskab
   som en permanent overstyring. Ved oprettelse skrives den derimod altid,
   når providren er Google og mindst ét medlem er valgt — der findes ingen
   "startværdi" at sammenligne mod ved en helt ny aftale.
4. **Tom ejerkreds rydder overstyringen** (sender Googles egen
   null-konvention for den navngivne private egenskab) i stedet for at
   sætte "ingen ejer" — fjerner man alle markeringer, falder aftalen
   tilbage til automatisk deltager-/kalender-match ved næste synk.
5. **Kun Google.** Ny prædikat `providerSupportsManualOwnerOverride()`
   (samme mønster som `providerSupportsRecurrenceCreation()` fra Sprint
   34) — Outlook/Apple/ICS er udenfor scope.

---

## Teknisk tilgang

- `googleCalendarTypes.ts`: `GoogleCalendarEvent.extendedProperties` (læs)
  og `GoogleCalendarEventRequest.extendedProperties` (skriv, værdier kan
  være `null` for at rydde en enkelt egenskab).
- `googleCalendarMapper.ts`: ny delt nøgle `ownerIdsOverrideKey` =
  `"boholtsOwnerIds"` (kommasepareret medlem-id-liste). Læses og gives
  forrang i `mapGoogleCalendarEvent()`.
- `googleCalendarWriteMapper.ts`: `WritableEvent` fik `ownerIdsOverride`.
  `mapGoogleEventWriteRequest()` skriver/rydder `extendedProperties`, kun
  når feltet er sat (samme "kun ved eksplicit ønske"-mønster som
  `recurrence`).
- `calendarEvent.ts`/`calendarEventInput.ts`: nyt `ownerIdsOverride?:
  CalendarOwnerId[]` — midlertidig skriveinstruks, samme mønster som
  `recurrenceEditScope` m.fl. fra Sprint 34/35.
- `calendarProvider.ts`: ny `providerSupportsManualOwnerOverride()`.
- `NewEventDialog.tsx`/`EditEventDialog.tsx`: `EventParticipantsSection`
  ("Hvem gælder aftalen for?") vises nu også for Google, ikke kun interne
  aftaler.
- `useEditEventDialogController.ts`: `ownerIdsChanged`-sammenligning
  afgør, om `ownerIdsOverride` sættes ved redigering.

---

## Kendte risici

1. **Kun Google.** Samme afgrænsning som recurrence-arbejdet.
2. **Overstyringen er "sticky".** Hvis en korrekt e-mail senere tilføjes
   som deltager på aftalen direkte i Google, vinder den manuelle
   overstyring stadig, indtil nogen selv rydder den (tomme markeringer).
   Vurderet som den rigtige opførsel — brugerens eksplicitte valg bør ikke
   tabe til et efterfølgende automatisk gæt uden at blive bedt om det.
3. **Ingen UI-indikation af, at en aftale HAR en manuel overstyring** (vs.
   automatisk matchet) — checkboksene ser ens ud i begge tilfælde. Kan
   tilføjes senere, hvis det viser sig forvirrende i praksis.

---

## Godkendelse

Godkendt mundtligt (valgte "Byg mulighed for manuelt at vælge ejer på en
Google-aftale" som svar på et direkte spørgsmål om løsningsretning).
