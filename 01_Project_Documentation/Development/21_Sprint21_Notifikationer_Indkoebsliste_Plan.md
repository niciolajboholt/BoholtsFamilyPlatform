# 21_Sprint21_Notifikationer_Indkoebsliste_Plan

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-15

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Plan for Sprint 21: to nye, sammenhængende features — **push-notifikationer**
(fundament, bruges af både kalender og indkøbsliste) og en **delt
indkøbsliste** med automatisk kategorisering. Udarbejdet efter research i
markedet (Cozi, FamilyWall, Picniic, OurHome, AnyList, OurGroceries, Bring!)
og en gennemgang af, hvad der reelt er teknisk muligt på den nuværende
Cloudflare Worker + D1-arkitektur (Sprint 20).

Samme princip som Sprint 20-planen: dette dokument er den autoritative,
GitHub-forankrede plan — intet arbejde påbegyndes, før Nicolaj har godkendt
den (se "Godkendelse" nederst).

---

## Baggrund og markedsresearch

**Butiks-integration (Rema 1000, Bilka, Nemlig.com) er fravalgt.** Ingen af
de tre har en officiel, stabil API til at modtage en indkøbsliste udefra:

- **Nemlig.com**: ingen offentlig API — kun uofficielle, reverse-engineerede
  endpoints. Upålideligt, kan stoppe uden varsel.
- **Rema 1000**: har sin egen delte indkøbsliste-funktion i appen (bygget
  til familie/venner), men ingen API til at pushe en ekstern liste ind.
- **Bilka (Salling Group)**: offentlig developer-API findes, men dækker
  butiksdata (adresser, åbningstider) — ikke indkøbslister/kurve.

I stedet bygger vi vores egen delte liste efter samme mønster som de bedste
apps i markedet (Cozi er tættest på vores eget koncept: kalender + delt
liste i én app til samme familie), og supplerer med en simpel "del som
tekst"-knap, så listen kan indsættes i hvilken kædes app man nu handler i.

**Kategorisering** er også fravalgt via ekstern produktdatabase: Open Food
Facts (gratis, åben) er stregkode-/mærkevare-fokuseret og dårlig til at
gætte kategori ud fra almindelig fritekst ("mælk", "æg"), og har
rate-limits (15 opslag/min). Selv de store apps (AnyList, OurGroceries)
løser fritekst-kategorisering med en kurateret ordbog, ikke en rigtig
produktdatabase — samme tilgang vælges her.

**Push-notifikationer** er teknisk bekræftet muligt på Cloudflare Workers:
Web Push (VAPID) kan sendes uden Node.js-specifikke crypto-biblioteker, via
Workers-kompatible pakker (fx `web-push-browser`, `PushForge`).

---

## Beslutninger (godkendt i chat, 2026-08-15)

1. **Indkøbsliste**: starter med **én** delt liste pr. familie, men
   datamodellen bygges til at understøtte **flere navngivne lister** fra
   dag ét, så det ikke kræver en senere migrering.
2. **Kategorisering**: kurateret dansk ordbog (almindelige varenavne →
   kategori), ikke en ekstern produktdatabase. Selvlærende: når en bruger
   manuelt retter en vares kategori, huskes rettelsen til fremtidige gæt.
3. **Synkronisering**: push-notifikationer bygges som et **fælles
   fundament**, brugt af både kalender (notifikation ved ny/ændret aftale)
   og indkøbsliste (notifikation ved ny vare) — ikke to separate
   implementationer.
4. **Butiks-deling**: en simpel "del som tekst"-knap (telefonens egen
   del-funktion) er tilstrækkeligt for nu. Ingen kæde-specifik integration.

---

## Del A — Push-notifikationer (fundament)

### Datamodel (ny D1-migration)

```sql
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

Et device = én subscription. En bruger kan have flere (telefon + computer).

### Arkitektur

1. **VAPID-nøglepar** genereres én gang, gemmes som Cloudflare-secret
   (privat nøgle) + i klientkonfiguration (offentlig nøgle) — samme mønster
   som `GOOGLE_CLIENT_SECRET` (Secrets Store, `wrangler.jsonc`).
2. **Klient**: beder om notifikations-tilladelse (brugerhandling, kan ikke
   automatiseres), registrerer en `PushSubscription` via service workeren
   (`PushManager`), sender den til en ny `/api/push/subscribe`-rute.
3. **Server**: ved en relevant ændring (se nedenfor), sender et Web
   Push-kald til hvert *andet* familiemedlems subscriptions — ikke
   afsenderens egne devices.
4. **Service worker**: `push`-event-handleren viser en native
   OS-notifikation (titel, korte tekst, evt. deep-link til den relevante
   side).

### Hvad trigger en notifikation (fase 1-omfang)

- Kalender: ny/redigeret/slettet aftale (afsenderen selv undtaget).
- Indkøbsliste: ny vare tilføjet (Del B).

### Kendte begrænsninger

- Kræver brugerens eksplicitte tilladelse i browseren — kan ikke
  fremtvinges, og afvises permanent, hvis brugeren siger nej første gang
  (skal nulstilles manuelt i browserens indstillinger).
- iOS/Safari kræver appen er "installeret" (tilføjet til hjemmeskærm) for
  at Web Push virker overhovedet — almindelig Safari-browsing understøtter
  det ikke. Bør testes eksplicit på Nicolajs/Christines telefoner.

---

## Del B — Indkøbsliste

### Datamodel (samme migration eller en efterfølgende)

```sql
CREATE TABLE shopping_lists (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE shopping_list_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL,
  category TEXT,
  is_checked INTEGER NOT NULL DEFAULT 0,
  added_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  checked_at TEXT
);

CREATE INDEX idx_shopping_list_items_list_id ON shopping_list_items(list_id);

-- Selvlærende kategori-ordbog: starter seedet med ~100-200 almindelige
-- danske varenavne, udvides når en bruger manuelt retter en kategori.
CREATE TABLE shopping_item_category_overrides (
  family_id TEXT NOT NULL REFERENCES families(id),
  item_name_normalized TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (family_id, item_name_normalized)
);
```

Første version viser kun én liste (per familie) i UI'et, men API'et er
list-scoped fra start — "opret ny liste" er en ren UI-tilføjelse senere,
ingen ny migration.

### Kategorisering — flow

1. Bruger skriver et varenavn.
2. Slå op i `shopping_item_category_overrides` (familiens egne rettelser) →
   derefter den indbyggede, kuraterede ordbog (kode, ikke database) →
   ellers "Andet".
3. Bruger kan altid ændre kategorien manuelt — gemmes som en override for
   familien, bruges automatisk næste gang samme (eller et lignende) navn
   optræder.

### UI

- Tilføj-vare-felt (fritekst).
- Liste grupperet efter kategori (Frugt & grønt, Mejeri, Kød, Bageri, Frost,
  Andet — fast, kort liste).
- Afkrydsning: nedtones/flyttes til bunden af sin kategori, ikke fjernet
  med det samme (samme mønster som "Shopping mode" i Cozi/OurGroceries).
- "Ryd afkrydsede"-handling.
- "Del som tekst"-knap: Web Share API (`navigator.share`) med
  clipboard-fallback for browsere uden understøttelse.
- Erstatter "Indkøbsliste"-badgets nuværende "Snart"-tilstand på forsiden.

### Server-ruter (mønster fra `families.ts`)

- `GET/POST /api/families/:id/shopping-lists`
- `GET /api/families/:id/shopping-lists/:listId/items`
- `POST /api/families/:id/shopping-lists/:listId/items`
- `PATCH/DELETE /api/families/:id/shopping-lists/:listId/items/:itemId`
- `PUT /api/families/:id/shopping-lists/:listId/items/:itemId/category`
  (skriver samtidig til `shopping_item_category_overrides`)

---

## Rækkefølge

1. ~~**Del A — Push-notifikationer**~~ ✅ **Fundament gennemført og
   verificeret (2026-08-15)**: datamodel, VAPID-fundament,
   abonnements-flow, service worker-håndtering (skiftet PWA'en fra
   generateSW til injectManifest for at kunne tilføje push/
   notificationclick-lyttere). Testet isoleret med en reel test-notifikation
   på beta (Windows/Edge) — bekræftet leveret. iOS Safari-testen (kræver
   "føjet til hjemmeskærm", se "Kendte begrænsninger") er endnu ikke udført.
2. ~~**Del A, fortsat**~~ ✅ **Gennemført (2026-08-15)**: opret/redigér/slet
   af en aftale (`/api/calendar/calendars/:id/events`) sender nu en
   push-notifikation til familiens øvrige medlemmer (afsenderen selv
   undtaget), via `c.executionCtx.waitUntil()` så det ikke forsinker selve
   kalender-svaret. Mangler stadig en rigtig to-personers test (Nicolaj
   opretter, Christine modtager) — kun teknisk verificeret via
   automatiserede tests indtil videre.
3. ~~**Del B — Indkøbsliste**~~ ✅ **Gennemført (2026-08-15)**: datamodel
   (migration `0006_shopping_lists.sql`), server-ruter
   (`server/routes/shoppingLists.ts`, mønster fra `families.ts`), kategori-
   ordbog med selvlæring (`shoppingCategories.ts` +
   `shopping_item_category_overrides`), 16 automatiserede tests. Migration
   0006 er kørt manuelt via D1-konsollen på både beta og produktion
   (2026-08-16) og bekræftet — alle tre tabeller findes nu i begge
   databaser.
4. ~~**Del B, fortsat**~~ ✅ **Gennemført (2026-08-15)**: `ShoppingListPage`
   koblet til routeren (`/shopping-list`) og forsidens "Indkøbsliste"-knap
   (ikke længere "Snart"). Tilføjelse af en vare sender en
   push-notifikation til familiens øvrige medlemmer via Del A's fundament
   (`sendPushNotificationToFamily`). Lint, `tsc -b`, 213/213 tests og build
   verificeret grønne; deployet til `develop` (commit `e3533e1`), CI og
   begge Cloudflare Workers Builds (beta + produktion) bekræftet grønne.
5. Manuel test på beta af Nicolaj og Christine, inkl. eksplicit iOS/Safari
   push-test (se "Kendte begrænsninger") — **afventer stadig**. Del A's
   push-fundament virker bekræftet på Windows/Edge, men notifikationer
   viser sig endnu ikke på hverken Nicolajs eller Christines iPhone, selvom
   Apples push-tjeneste nu kvitterer med `200` uden fejl (to reelle bugs
   fundet og rettet undervejs: tavs fejlhåndtering af ikke-2xx-svar, og et
   dobbelt `mailto:`-præfiks i VAPID JWT'ets `sub`-claim). Årsagen til at
   notifikationen stadig ikke vises på selve enheden er uafklaret — næste
   skridt er enten Safari Remote Web Inspector (kræver Mac + kabel) eller
   en fuld af-/geninstallation af PWA'en fra hjemmeskærmen.

---

## Kendte risici

1. **iOS Safari's Web Push-krav** (appen skal være "føjet til hjemmeskærm")
   er en reel brugsbarriere — skal kommunikeres tydeligt til Nicolaj/
   Christine, ikke opdages som en "bug" senere.
2. **Kategori-ordbogens dækning** vil være ufuldstændig ved lancering — en
   del varer lander i "Andet" indtil ordbogen har lært af brug. Acceptabel,
   forventet start-tilstand, ikke en fejl.
3. **Ingen ægte realtid** i første version (push-notifikationer er
   asynkrone beskeder, ikke et live-synkroniseret UI) — hvis nogen har
   listen åben, mens en anden tilføjer noget, opdateres visningen først ved
   næste genindlæsning/fokus, med en notifikation som hint om at opdatere.

---

## Godkendelse

Intet kodearbejde påbegyndes, før Nicolaj har godkendt denne plan —
herunder specifikt beslutningerne under "Beslutninger" ovenfor. Godkend ved
at sige til i chatten; dette dokument opdateres derefter til
**Status: Active**, og arbejdet begynder med Del A, punkt 1.
