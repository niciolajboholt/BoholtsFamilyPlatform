# 41_Sprint41_Deleoekonomi_Foraeldre_Plan

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

Et simpelt "hvem betalte/hvem skylder"-overblik mellem forældre for
fælles udgifter (fødselsdagsgaver, fritidsaktiviteter) — bevidst IKKE
fuld bogføring, kun et overblik. Det mest selvstændige af Del B's
punkter: ingen eksisterende tabel eller funktion i appen ligner dette i
dag, ud over det generelle familie-/medlemskabsgrundlag.

---

## Foreslåede beslutninger

1. **Ny tabel `shared_expenses`**: `id`, `family_id`, `description`,
   `amount`, `paid_by_member_id` (hvem lagde ud), `split_between`
   (JSON-array af `family_member_id`'er, der deler udgiften — ikke en
   separat kobletabel, da antallet af deltagere pr. udgift er lille og
   ikke selvstændigt skal forespørges), `expense_date`,
   `created_by_user_id`, `created_at`.
2. **Simpel ligelig deling i v1** — beløbet deles ligeligt mellem
   `split_between`-medlemmerne, ingen vægtet/ulige fordeling. En mere
   fleksibel model (fx "Nicolaj betalte 300, Christine skylder 200")
   udskydes bevidst, da det markant øger kompleksiteten for en funktion,
   der eksplicit skal være "ikke fuld bogføring".
3. **Saldo beregnes ved forespørgsel, samme princip som
   lommepenge-ledgeren (Sprint 39)** — ikke et cachet felt. For hvert
   par af medlemmer: summen af, hvad den ene har lagt ud for den anden,
   minus omvendt. Vises som "Christine skylder Nicolaj 150 kr.", ikke en
   kompliceret gruppe-afregningsalgoritme (relevant kun ved 3+ betalende
   voksne, som ikke er den typiske familiestørrelse i denne app).
4. **Kun synligt for medlemmer med en tilknyttet bruger
   (`linked_user_id`)** — dvs. reelt forældre/voksne, ikke børneprofiler,
   da "hvem skylder hvem penge" ikke er en børnerelevant funktion (i
   modsætning til Sprint 39's lommepenge, som specifikt ER
   børnerelevant).
5. **Ingen betalingsintegration.** Udelukkende et overblik — en "marker
   som afregnet"-handling nulstiller den viste saldo for det pågældende
   par, uden at foretage nogen rigtig pengeoverførsel. Samme
   afgrænsning som Sprint 39's bevidste udeladelse af en
   udbetalings-handling.
6. **Ny side/afsnit:** enten et nyt afsnit i Indstillinger (mindre
   omfang) eller en helt ny, lille side `/shared-expenses` — anbefalet:
   nyt afsnit i Indstillinger under en "Familie"-relateret sektion, da
   funktionen er lav-frekvens brugt sammenlignet med kalender/opgaver/
   indkøb, som allerede har egne hovedsider.

---

## Kendte risici og åbne spørgsmål

- **Valuta antaget DKK, ingen internationalisering** — konsistent med
  resten af appen (dansk UI, ingen flersprogs- eller
  flervaluta-understøttelse noget sted).
- **Hvad tæller som "afregnet"?** En simpel boolean-nulstilling (v1) vs.
  en historik over afregninger (mere robust, men større scope) — anbefalet
  at starte med den simple model og evaluere behovet, når funktionen
  reelt er i brug.
- **Navnekollision med Sprint 39's lommepenge-ledger-mønster:** begge
  sprints indfører en "beregn saldo fra transaktionslog"-model. Overvej
  ved implementering, om en delt, generisk hjælpefunktion giver mening,
  eller om de to er forskellige nok (personlig lommepenge vs. par-vis
  gæld mellem voksne) til at holde adskilt — ikke afgjort her, da
  Sprint 39 endnu ikke er bygget på beslutningstidspunktet for dette
  dokument.

---

## Kvalitetsgate

Som de øvrige sprints: `npm run lint`, `npm run build`, `npm test`,
`npm run test:e2e` grønne før merge. Ny migration verificeres manuelt med
`SELECT ... FROM sqlite_master` på beta.
