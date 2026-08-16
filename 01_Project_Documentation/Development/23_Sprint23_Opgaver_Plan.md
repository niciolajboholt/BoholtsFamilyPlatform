# 23_Sprint23_Opgaver_Plan

> Status: Afventer godkendelse

Version: 2.0

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
Tiimo-inspireret opgaveløsning: visuelle ikoner pr. opgave, faste rutiner
(morgen-/aftenrutiner), en personlig og en familie-visning — samt et
AI-modul, der kan generere en rutine ud fra en sætning, og foreslå
indkøbsliste-ingredienser ud fra en ret. Udvidet efter chat 2026-08-16 fra
en simpel opgaveliste til at dække rutiner og AI, efter Nicolajs feedback.

**Integration, ikke efterligning via API.** Tiimo er et lukket
forbruger-abonnementsprodukt uden offentlig API — samme situation som
Rema/Bilka/Nemlig i Sprint 21. Vi bygger derfor vores egen version,
inspireret af Tiimos UX-principper og AI-planlægger, ikke en integration.

---

## Beslutninger (godkendt/afklaret i chat, 2026-08-16)

1. **Personlig og familie-rettet, i én datamodel.** En opgave/rutine kan
   enten tildeles ét familiemedlem eller "Hele familien" (samme
   pseudomedlem-mønster som kalenderen). UI'et får to visninger: "Min dag"
   (dine egne + familiens fælles opgaver) og "Familien" (alles).
2. **Rutiner er med fra start** — ikke udskudt til v2, som først
   foreslået. En rutine er en skabelon (navn, ugedage, en ordnet liste af
   opgaver med ikon/tid); dagens konkrete opgaver **genereres dovent**
   (lazy), første gang nogen åbner opgavesiden den dag — samme teknik som
   indkøbslistens "opret standardliste ved første opslag". Ingen
   Cloudflare Cron Trigger nødvendig.
3. **Fast ikonsæt i kode** — ligesom indkøbslistens kategorier. Forslag
   til opstartssæt (ret/udvid gerne): Morgen, Mad, Skole/lektier,
   Hygiejne, Motion, Læsning, Husholdning, Kæledyr, Fritid, Aften/sengetid
   — MUI-ikoner, ikke emojis.
4. **AI-modul via Cloudflare Workers AI**, ikke en ekstern udbyder som
   Claude API — data forlader ikke Cloudflares infrastruktur. Bruger en
   let, gratis-tilgængelig model (fx `@cf/zai-org/glm-4.7-flash`), ikke en
   af de store, betalingskrævende modeller — 10.000 Neurons/dag er gratis,
   og et par forespørgsler om dagen til en familie bør holde sig godt
   inden for det. To funktioner:
   - Skriv en sætning ("Alfred skal have en morgenrutine med tandbørstning,
     tøj og skoletaske") → AI foreslår en rutine (opgaver + ikoner + evt.
     tider) som et **udkast**, du godkender/retter, før den gemmes.
   - Skriv en ret ("spaghetti bolognese") i indkøbslisten → AI foreslår en
     ingrediensliste som et udkast, du vælger hvilke der skal tilføjes
     (auto-kategoriseret af den eksisterende ordbog, ikke af AI'en).
   - **AI'en foreslår altid kun et udkast — intet gemmes automatisk.**
     Sprogmodeller kan tage fejl eller opfinde ting, og det skal aldrig
     stille og roligt ende som en "rigtig" opgave eller vare uden et
     menneske har kigget på det.
5. **Ingen tidsbaserede påmindelser i v1.** Et valgfrit tidspunkt på en
   opgave bruges kun til sortering (som Tiimos tidslinje), ikke til en
   push-notifikation der affyres *på* tidspunktet — det ville kræve en
   Cron Trigger, en ny type infrastruktur denne app ikke har endnu. I
   stedet genbruges det eksisterende push-mønster: en notifikation sendes,
   når en opgave/rutine oprettes og tildeles et medlem.

---

## Datamodel (ny migration)

```sql
CREATE TABLE task_routines (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES family_members(id), -- NULL = hele familien
  weekdays TEXT NOT NULL, -- fx "1,2,3,4,5" (mandag-fredag)
  created_at TEXT NOT NULL
);

CREATE TABLE task_routine_items (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES task_routines(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  time_of_day TEXT,
  sort_order INTEGER NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES family_members(id), -- NULL = hele familien
  time_of_day TEXT,
  is_done INTEGER NOT NULL DEFAULT 0,
  routine_item_id TEXT REFERENCES task_routine_items(id), -- NULL for engangsopgaver
  task_date TEXT, -- "2026-08-16", kun sat for rutine-genererede opgaver
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE INDEX idx_tasks_family_id_date ON tasks(family_id, task_date);
CREATE UNIQUE INDEX idx_tasks_routine_item_date ON tasks(routine_item_id, task_date)
  WHERE routine_item_id IS NOT NULL; -- forhindrer dobbelt-generering samme dag
```

Engangsopgaver (ingen rutine) har `routine_item_id`/`task_date` som `NULL`
og ryddes manuelt med "Ryd udførte" (som indkøbslisten). Rutine-genererede
opgaver har begge sat, og unik-indekset forhindrer at samme rutine-punkt
genereres to gange samme dag, selvom flere familiemedlemmer åbner siden
samtidig.

## Server-ruter

- `GET /api/families/:id/tasks?date=YYYY-MM-DD` — materialiserer dagens
  rutine-opgaver (hvis ikke allerede gjort) og returnerer alle opgaver for
  dagen, inkl. engangsopgaver.
- `POST /api/families/:id/tasks` — engangsopgave.
- `PATCH /api/families/:id/tasks/:taskId` — isDone, navn, ikon, tid.
- `DELETE /api/families/:id/tasks/:taskId`
- `POST /api/families/:id/tasks/clear-done`
- `GET/POST/PATCH/DELETE /api/families/:id/task-routines` — rutine-CRUD.
- `POST /api/families/:id/task-routines/generate-draft` — AI-udkast fra
  fritekst (gemmer intet).
- `POST /api/families/:id/shopping-lists/:listId/generate-ingredients-draft`
  — AI-udkast af ingredienser fra en ret (gemmer intet).

## Klient

- `TasksPage`: "Min dag" / "Familien"-faner, opgaver sorteret efter
  tidspunkt, ikon + navn + evt. medlems-avatar + afkrydsning. "Opret
  rutine"-flow med en AI-assisteret fritekst-mulighed ("beskriv rutinen,
  så foreslår vi opgaverne") ved siden af manuel opsætning.
- `ShoppingListPage`: en "Foreslå ud fra en ret"-knap ved siden af det
  almindelige tilføj-felt, viser AI'ens udkast som afkrydsningsbare
  forslag, før noget føjes til listen.

---

## Rækkefølge

1. Migration + server-ruter for opgaver og rutiner (uden AI), med
   automatiserede tests — den lazy-materialisering er den vigtigste logik
   at få testet grundigt.
2. Klient: `TasksPage`, ikon-vælger, "Min dag"/"Familien"-faner, manuel
   rutine-opsætning, kobling til forsiden.
3. AI-modul: Workers AI-binding i `wrangler.jsonc`, de to
   generate-draft-ruter, klient-UI til at vise og vælge blandt forslag.
4. Manuel test på beta/produktion, inkl. AI-forslagenes kvalitet.

---

## Kendte risici

1. **Workers AI's mindre modeller kan give ringere forslag** end en
   større model ville — accepteret bevidst til fordel for at data forbliver
   i Cloudflares infrastruktur. Kan genovervejes senere, hvis kvaliteten
   ikke er god nok i praksis.
2. **Lazy-materialisering af rutiner kræver omhyggelig samtidigheds­håndtering**
   (to familiemedlemmer åbner appen samme sekund) — løses med
   unik-indekset ovenfor, men skal testes eksplicit, ikke kun antages.
3. **Ikonsættet er et forslag** — ret gerne før godkendelse.
4. **Ingen tidsbaserede påmindelser i v1** — se beslutning 5.

---

## Godkendelse

Intet kodearbejde påbegyndes, før Nicolaj har godkendt denne plan —
herunder specifikt beslutningerne ovenfor. Godkend ved at sige til i
chatten.
