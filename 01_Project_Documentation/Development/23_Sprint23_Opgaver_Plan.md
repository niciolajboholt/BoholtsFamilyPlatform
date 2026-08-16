# 23_Sprint23_Opgaver_Plan

> Status: Afventer godkendelse

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-16

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Erstat "Opgaver"-badgets nuværende "Snart"-tilstand på forsiden med en
Tiimo-inspireret opgaveliste: visuelle ikoner pr. opgave, valgfrit
tidspunkt på dagen, og et roligt, ikke-overvældende UI — frem for en
traditionel, tekst-tung to-do-liste.

**Integration, ikke efterligning via API.** Tiimo er et lukket
forbruger-abonnementsprodukt uden offentlig API — samme situation som
Rema/Bilka/Nemlig i Sprint 21. Vi bygger derfor vores egen version,
inspireret af Tiimos UX-principper, ikke en integration.

---

## Beslutninger (til godkendelse)

1. **Familie-delt, ikke personlig/privat** — samme model som resten af
   appen (kalender, indkøbsliste): opgaver hører til familien, kan valgfrit
   tildeles ét familiemedlem (eller "Hele familien", samme mønster som
   kalenderens pseudomedlem). Ingen privat, kun-mig-liste i v1.
2. **Ingen rutiner/gentagelse i v1.** Tiimos kerne er faste daglige
   rutiner — det udskydes bevidst. V1 er engangsopgaver, der ryddes manuelt
   (samme "Ryd afkrydsede"-mønster som indkøbslisten), ikke opgaver der
   automatisk genopstår hver dag.
3. **Fast ikonsæt i kode** — ligesom indkøbslistens kategorier. Forslag til
   et opstartssæt (ret/udvid gerne): ☀️ Morgen, 🍽️ Mad, 🎒 Skole/lektier,
   🪥 Hygiejne, 🏃 Motion, 📖 Læsning, 🧹 Husholdning, 🐾 Kæledyr, ⚽ Fritid,
   🌙 Aften/sengetid — implementeret som MUI-ikoner, ikke emojis.
4. **Ingen tidsbaserede påmindelser i v1.** Et valgfrit tidspunkt på
   opgaven bruges kun til sortering (som Tiimos tidslinje), ikke til en
   push-notifikation, der affyres *på* tidspunktet — det kræver en
   Cloudflare Cron Trigger (planlagt baggrundsjob), som ikke findes i appen
   endnu. I stedet genbruges det eksisterende push-mønster: en
   notifikation sendes til familien, når en opgave *oprettes* og tildeles
   et medlem (samme som indkøbslistens "ny vare tilføjet").

---

## Datamodel (ny migration)

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES family_members(id), -- NULL = hele familien
  time_of_day TEXT, -- "07:30", valgfri, kun til sortering
  is_done INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE INDEX idx_tasks_family_id ON tasks(family_id);
```

## Server-ruter (mønster fra `shoppingLists.ts`)

- `GET /api/families/:id/tasks`
- `POST /api/families/:id/tasks` (name, icon, valgfri assignedMemberId,
  timeOfDay) — sender push-notifikation til familien ved tildeling
- `PATCH /api/families/:id/tasks/:taskId` (isDone, eller ret navn/ikon/tid)
- `DELETE /api/families/:id/tasks/:taskId`
- `POST /api/families/:id/tasks/clear-done`

## Klient

Ny side `TasksPage`, samme struktur som `ShoppingListPage`: tilføj-formular
(navn + ikon-vælger + valgfrit tidspunkt + valgfri tildeling), liste sorteret
efter tidspunkt (opgaver uden tid til sidst), hver opgave viser ikon +
navn + evt. medlemmets avatar + afkrydsning, "Ryd udførte"-knap. Erstatter
"Opgaver"-badgets "Snart"-tilstand på forsiden.

---

## Rækkefølge

1. Migration + server-ruter, med automatiserede tests.
2. Klient: `TasksPage`, ikon-vælger, kobling til forsiden.
3. Push-notifikation ved tildeling (genbruger Sprint 21's fundament).
4. Manuel test på beta/produktion.

---

## Kendte risici

1. **Ingen tidsbaserede påmindelser i v1** — en reel "ping klokken 7:30"
   kræver Cron Triggers, en ny type infrastruktur i denne app. Kan tilføjes
   som en selvstændig v2, hvis det viser sig at være det, der efterspørges
   mest i praksis.
2. **Ingen rutiner/gentagelse i v1** — hver dag skal opgaver tilføjes eller
   ryddes manuelt igen. Samme accepterede start-begrænsning som
   indkøbslisten havde med kategori-dækning.
3. **Ikonsættet er et forslag** — ret gerne før godkendelse, hvis noget
   oplagt mangler eller er forkert grupperet.

---

## Godkendelse

Intet kodearbejde påbegyndes, før Nicolaj har godkendt denne plan —
herunder specifikt beslutningerne ovenfor (særligt fravalget af rutiner og
tidsbaserede påmindelser i v1). Godkend ved at sige til i chatten.
