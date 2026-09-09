# 39_Sprint39_Lommepenge_Opgavebeloenning_Plan

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

Et fast eller variabelt beløb pr. fuldført opgave, med et enkelt
saldo-overblik pr. familiemedlem — bygger direkte på den eksisterende
Tiimo-inspirerede opgaveløsning (Sprint 23).

---

## Verificeret grundlag

- `tasks`-tabellen (`server/migrations/0008_tasks.sql`) har allerede
  `assigned_member_id`, `is_done`, `done_at` — præcis de felter, en
  belønning skal reagere på. Ingen beløbs- eller saldo-relaterede felter
  findes i dag.
- Opgaver kan i dag være familie-rettede (`assigned_member_id IS NULL`) —
  disse kan pr. definition ikke udløse en personlig belønning og skal
  eksplicit undtages, ikke bare ignoreres implicit.
- Rutine-opgaver (`task_routine_items`) materialiseres dovent til
  `tasks`-rækker (ingen cron, se `0008_tasks.sql`s kommentar) — en
  belønning pr. fuldførelse fungerer derfor automatisk for både
  engangsopgaver og rutineopgaver, uden særskilt håndtering.

---

## Foreslåede beslutninger

1. **Beløb sættes pr. opgave, ikke globalt.** Et valgfrit `reward_amount`-
   felt (heltal, øre eller hele kroner — afklares med Nicolaj) på
   `tasks`/`task_routine_items` ved oprettelse, standard 0 (ingen
   belønning). Undgår en separat "beløbstabel pr. opgavetype", som ville
   kræve en ekstra kobling for hver opgave.
2. **Ny tabel `allowance_ledger`** (append-only, samme princip som en
   rigtig transaktionslog, ikke et enkelt `balance`-felt der kan komme ud
   af trit): `id`, `family_id`, `family_member_id`, `amount`,
   `task_id` (nullable — en fremtidig manuel korrektion har intet
   `task_id`), `created_at`. Saldoen beregnes som `SUM(amount)` ved
   forespørgsel, ikke et cachet felt — undgår en synkroniseringsfejl
   mellem log og saldo, som en cache-model ville risikere.
3. **Belønningen bogføres, når opgaven markeres fuldført** (samme
   PATCH-endpoint som allerede sætter `is_done`/`done_at`), ikke via et
   separat "godkend belønning"-skridt i v1 — en forælder, der opretter
   opgaven med et beløb, har allerede taget stilling til, at den er
   penge værd, hvis den udføres.
4. **Saldo-overblik vises på et nyt afsnit på `TasksPage`** (samme side,
   ikke en helt ny fane) — én linje pr. familiemedlem med beløb,
   synligt for alle (som resten af familiens data), ikke kun ejeren selv.
5. **Ingen udbetalings-/nulstillings-handling i v1.** En forælder kan se
   saldoen og selv holde styr på faktisk udbetaling uden for appen — at
   bygge en "marker som udbetalt"-handling er en selvstændig
   produktbeslutning (skal det nulstille saldoen, eller blot logge en
   negativ post?), foreslås som en mulig opfølgning, ikke antaget her.

---

## Kendte risici og åbne spørgsmål

- **Beløbsenhed og -format** (hele kroner vs. øre, `DKK`-formatering i
  UI'et) skal afklares med Nicolaj før migrationen skrives — et forkert
  valgt heltal-format er dyrt at ændre bagefter uden en datamigrering.
- **Skal et barn uden egen konto (kun en profil, jf. ADR-017 punkt 5)
  kunne se sin egen saldo selv**, eller er det udelukkende en
  forælder-funktion? Antaget: synligt for alle, som resten af
  familiedata — men værd at bekræfte, da det er en reel
  privatlivs-/pædagogisk beslutning, ikke kun en teknisk detalje.
- **Sletning af en opgave med bogført belønning:** ledger-rækken bør
  bevares (historik), selvom opgaven slettes — kræver at `task_id`
  IKKE er en hård fremmednøgle med `ON DELETE CASCADE`, kun en løs
  reference.

---

## Kvalitetsgate

Som de øvrige sprints: `npm run lint`, `npm run build`, `npm test`,
`npm run test:e2e` grønne før merge. Ny migration verificeres manuelt med
`SELECT ... FROM sqlite_master` på beta.
