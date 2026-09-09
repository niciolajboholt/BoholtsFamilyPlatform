# 43_Sprint43_Kiosk_Dashboard_Plan

> Status: Forslag — afventer godkendelse af scope/rækkefølge

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-09-09

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Et forenklet, læsevenligt "kiosk-mode"-dashboard (dagens aftaler,
opgaver, indkøbsliste) designet til en fast skærm eller tablet i
køkkenet — genbruger eksisterende data, ny præsentation. Ingen ny
backend-funktionalitet er nødvendig; dette er et rent frontend-sprint.

---

## Verificeret grundlag

- `AppRouter.tsx` viser allerede mønsteret for en rute UDEN
  `AppLayout`-chrome (`share/:token` → `PublicSharedCalendarPage`, "Sprint
  26: uden for AppLayout bevidst"). Kiosk-mode er samme princip: en
  dedikeret rute uden sidemenu/navigation, men i modsætning til delelinket
  SKAL den forblive bag login (viser opgaver/indkøb, ikke kun
  kalenderaftaler — reelt familiedata, ikke noget beregnet til
  udenforstående).
- Data findes allerede tilgængelig via eksisterende hooks: `useTasks()`,
  `useShoppingList()`, kalenderens `useCalendarPageController()` (eller en
  udtrukket delmængde af den) — kiosk-siden skal IKKE bygge nye
  server-endpoints, kun en ny sammensætning af eksisterende klient-data.

---

## Foreslåede beslutninger

1. **Ny rute `/kiosk`, egen `KioskPage.tsx`, forbliver bag login** (dvs.
   stadig kræver en gyldig session — en delt køkkenskærm er typisk
   allerede logget ind permanent, samme antagelse som en fastmonteret
   tablet i praksis) — men UDEN `AppLayout`s sidemenu/navigation, samme
   struktur-princip som `PublicSharedCalendarPage`.
2. **Skrivebeskyttet i v1.** Ingen "afkryds opgave"/"tilføj vare"-handling
   direkte fra kiosk-visningen — kun visning. Reducerer omfanget markant
   og undgår en hel ny interaktionsmodel optimeret til berøring på en
   stor skærm på afstand. En interaktiv version kan være en selvstændig
   opfølgning, hvis det reelt efterspørges efter brug.
3. **Indhold: dagens kalenderaftaler (ikke hele ugen), ufuldførte opgaver
   for dagen, og indkøbslistens ikke-afkrydsede varer** — samme
   "dagens overblik"-princip som forsidens eksisterende widgets, blot i
   et layout optimeret til en stor skærm set på afstand (større
   skrifttype, ingen scrolling forventet ved normal mængde data).
4. **Auto-opdatering, ikke manuel refresh.** En fastmonteret skærm har
   ingen bruger til at trykke "opdater" — periodisk polling (fx hvert 2.
   minut, klientside `setInterval`, samme lette mønster som andre
   dele af appen allerede bruger til baggrunds-synk) i stedet for en ny
   server-side push-mekanisme, som ville være unødvendig kompleksitet for
   denne brugssituation.
5. **Ingen ny mørk/lys-tema-beslutning påkrævet** — genbruger appens
   eksisterende MUI-tema, blot med større typografi-varianter i selve
   kiosk-layoutet.

---

## Kendte risici og åbne spørgsmål

- **Session-levetid på en delt køkkenskærm:** Den nuværende session
  varer 30 dage uden fornyelse (jf. Sprint 33-planens fund) — værd at
  bekræfte, at det er acceptabelt for en skærm, der forventes at blive
  stående tændt/logget ind i lang tid, eller om kiosk-siden bør bruge en
  længere/anderledes session-levetid. Dette er en produktbeslutning, ikke
  kun en teknisk detalje — eskaléres til Nicolaj før implementering.
- **Skærmlås/screensaver på selve tabletten** er uden for appens kontrol
  (styres af enhedens OS) — ikke noget dette sprint kan eller skal løse.
- **Hvilket familiemedlems kalender/opgaver vises**, hvis skærmen ikke er
  knyttet til én bestemt person? Antaget: hele familiens data samlet
  (samme som forsiden i dag), ikke et personligt filter — bør bekræftes.

---

## Kvalitetsgate

`npm run lint`, `npm run build`, `npm test`, `npm run test:e2e` grønne
før merge. Ingen ny migration i dette sprint (rent frontend), så ingen
manuel D1-verifikation nødvendig.
