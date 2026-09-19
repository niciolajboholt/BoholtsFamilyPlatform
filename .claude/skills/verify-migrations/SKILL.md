---
name: verify-migrations
description: Verificér D1-migrationsstatus mod beta og produktion direkte i databasen, i stedet for at antage "kørt"/"bekræftet". Brug denne før en migration regnes for deployet, eller når nogen siger en migration er kørt.
---

# Verificér D1-migrationer

Boholts Family Platform har haft flere kostbare hændelser (se
`01_Project_Documentation/AI_Knowledge_Base/09_Lessons_Learned.md`), hvor en
migration blev antaget anvendt — fordi CI var grønt, koden var merget, eller
en bruger sagde "kørt" — uden at det reelt var tilfældet i produktion. En
brugerpåstand eller en grøn CI er **ikke** en verifikation. Denne skill
tjekker den faktiske databaseskemaet direkte.

Bemærk: `.github/workflows/ci.yml`s `deploy-beta`/`deploy-production`-jobs
kører i dag `wrangler d1 migrations apply` automatisk ved push til
`develop`/`main`, hvilket er en anden proces end den README/Lessons Learned
beskriver (manuel kørsel via D1-konsollen). Flag denne uoverensstemmelse til
Nicolaj hvis den ikke allerede er kendt — antag ikke selv hvilken der er
"den rigtige".

## Fremgangsmåde

Kør fra `05_App/web` (hvor `wrangler.jsonc` ligger):

1. Hent listen over lokale migrationsfiler:
   ```bash
   ls server/migrations/*.sql
   ```

2. Hent `d1_migrations`-registret for **begge** miljøer:
   ```bash
   npx wrangler d1 execute DB --env beta --remote --command \
     "SELECT name FROM d1_migrations ORDER BY name;"

   npx wrangler d1 execute DB --remote --command \
     "SELECT name FROM d1_migrations ORDER BY name;"
   ```
   (Ingen `--env`-flag for produktion — se `wrangler.jsonc`, hvor produktion
   er det unavngivne miljø og beta er `env.beta`.)

3. Sammenlign filnavnene fra trin 1 mod begge lister fra trin 2. Rapportér
   eksplicit for hvert miljø:
   - Migrationer der findes lokalt, men mangler i `d1_migrations`.
   - Migrationer i `d1_migrations`, der ikke findes som lokal fil (uventet —
     undersøg før noget andet).

4. Ved uoverensstemmelse (eller hvis en migration ser rigtig ud i registret,
   men noget stadig fejler i appen): bekræft det faktiske skema, ikke kun
   registret:
   ```bash
   npx wrangler d1 execute DB --env beta --remote --command \
     "SELECT type, name, sql FROM sqlite_master WHERE type='table' ORDER BY name;"

   npx wrangler d1 execute DB --remote --command \
     "SELECT type, name, sql FROM sqlite_master WHERE type='table' ORDER BY name;"
   ```

5. Rapportér resultatet til Nicolaj som en konkret status pr. miljø
   ("beta: alt anvendt" / "produktion: mangler 0029_icloud_calendar_connections.sql")
   — skriv aldrig "bekræftet"/"kørt" uden at have set outputtet af en af
   forespørgslerne ovenfor i denne session.

## Krav

`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (eller en lokal `wrangler
login`-session) skal være til stede for at `wrangler d1 execute --remote`
kan køre.
