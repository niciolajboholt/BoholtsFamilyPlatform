# 42_Sprint42_Danske_Skoleferier_Plan

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

Import af danske skoleferie-/lukkedage som en read-only kalenderkilde,
samme mønster som de eksisterende Google/Outlook/ICS-udbydere.

---

## Verificeret grundlag — dette er nok det MINST kodetunge punkt i Del B

`ics_calendar_subscriptions` (Fase 9, `0018_ics_calendar_subscriptions.sql`)
er allerede en fuldt fungerende, generisk mekanisme til præcis dette:
enhver familie kan i dag, gennem den eksisterende UI i Indstillinger
("Kalenderforbindelser"), tilføje en vilkårlig offentlig ICS-URL som en
skrivebeskyttet, delt kalenderkilde, tildelt et familiemedlem eller ikke.
Klienten henter og parser feeden direkte (`IcsCalendarProvider.ts`,
`icsCalendar.ts`) — ingen server-cron, ingen ny tabel, intet nyt
API-endpoint.

**Det betyder, at hvis en offentlig, pålidelig ICS-feed med danske
skoleferier/lukkedage findes,** kræver dette punkt potentielt INGEN ny
kode — kun at Nicolaj (eller en anden forælder) selv tilføjer feeden via
den eksisterende "Tilføj delt kalender"-dialog. Dette skal verificeres
først, før noget kodes.

---

## Foreslåede beslutninger

1. **Research først, kode kun hvis nødvendigt.** Undersøg om en stabil,
   offentlig ICS-feed for danske skoleferier/lukkedage findes (fx fra en
   kommune, UVM, eller en tredjepartstjeneste). Hvis en sådan feed findes
   og fungerer gennem den eksisterende ICS-import uden ændringer, er
   sprintet reelt en DOKUMENTATIONS-opgave (find og verificér URL'en,
   skriv en kort guide) plus evt. en UX-genvej (se punkt 2) — ikke en
   kodeopgave.
2. **Hvis en genvej ønskes:** en foruddefineret "Tilføj danske
   skoleferier"-knap i "Kalenderforbindelser"-dialogen, der udfylder URL
   og label automatisk (i stedet for at kræve, at brugeren selv finder og
   indtaster en URL) — en lille UI-tilføjelse til
   `IcsSubscriptionsDialog.tsx`, ikke en ny mekanisme.
3. **Hvis INGEN pålidelig samlet offentlig feed findes** (fx fordi hver
   kommune publicerer sin egen, uden en landsdækkende samlet kilde), er
   den ærlige konklusion at eskalere til Nicolaj som en produktbeslutning
   (skal appen vedligeholde sin egen liste af skoleferiedatoer manuelt i
   stedet?) — IKKE at bygge en kompleks løsning eller gætte forkert data
   for en funktion, der handler om børns skolegang.
4. **Farve/visning:** skoleferier vises som almindelige heldags-aftaler i
   kalenderen, samme som enhver anden ICS-kilde — ingen ny visuel
   behandling nødvendig, dette er allerede løst generisk.

---

## Kendte risici og åbne spørgsmål

- **Datakvalitet er den reelle risiko her, ikke koden.** En forkert
  ferieuge (fx pga. en forældet eller kommune-specifik feed, mens familien
  bor et andet sted) er værre end ingen funktion — verificér kilden grundigt
  før den anbefales, og gør det tydeligt i UI'et, at det er en ekstern,
  ikke Boholt-vedligeholdt kilde.
- **Loft på 5 ICS-abonnementer pr. familie** (håndhævet i
  applikationslaget, se `0018`-migrationens kommentar) — en tilføjet
  skoleferie-feed tæller med i dette loft, ikke en undtagelse.

---

## Kvalitetsgate

Hvis punkt 2 (UI-genvej) implementeres: `npm run lint`, `npm run build`,
`npm test`, `npm run test:e2e` grønne før merge — men ingen ny migration,
så ingen manuel D1-verifikation nødvendig for dette sprint, medmindre
scope udvides undervejs.
