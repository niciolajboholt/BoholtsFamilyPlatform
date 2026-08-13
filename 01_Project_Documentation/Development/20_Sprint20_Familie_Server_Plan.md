# 20_Sprint20_Familie_Server_Plan

> Status: Active

Version: 1.0

Project:
Boholts Family Platform

Last Updated:
2026-08-13

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

---

## Formål

Revideret, GitHub-forankret plan for resten af Sprint 20 (ADR-017:
multi-tenant familie-server). Erstatter `lexical-dancing-liskov.md`, som lå
løst på `main` (uploadet manuelt via GitHub, ikke en del af den almindelige
gren-arbejdsgang) — indholdet derfra er indarbejdet her, krydstjekket mod den
faktiske kode på `feature/sprint-20-fase*`-branchene, ikke kun mod den
oprindelige plans antagelser.

Princip fremover: alt planlægningsarbejde for Sprint 20 lever i dette
dokument på `develop`, ikke i lokale filer — så både Nicolaj og enhver
AI-agent altid arbejder fra samme, opdaterede grundlag.

---

## Baggrund

Se ADR-017 i `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md`
for selve arkitekturbeslutningen (server-ejet Google-login, multi-tenant
familier, D1 gemmer aldrig selve kalenderaftalerne). Dette dokument er
eksekveringsplanen — hvad der er gjort, hvad der mangler, og i hvilken
rækkefølge.

---

## Status pr. fase (2026-08-13)

| Fase | Indhold | Status |
|---|---|---|
| 0 | Cloudflare Worker + D1-fundament | ✅ Merget til `develop` |
| 1 | Server-ejet Google-login + session | ✅ Merget til `develop`, verificeret på beta 2026-08-02 |
| 2 | Familier, medlemskab, invitationer | Bygget på `feature/sprint-20-fase2-families`. 24 rute-tests tilføjet 2026-08-13 (var udokumenteret, kun manuelt curl-testet før). PR #29 (draft) mod `develop`. |
| 3 | Server overtager Google Kalender-sync | Bygget på `feature/sprint-20-fase3-calendar-sync`. Tests tilføjet 2026-08-13. PR #28 (draft), stacket på Fase 2's branch. |
| 4 | Kalender-medlem-mapping → D1 | Første commit på `feature/sprint-20-fase4-shared-calendar-mapping` 2026-08-12. Endnu ikke gennemgået/testet. |
| 5 | Udfas lokale (ikke-Google) aftaler + migrering | Ikke startet. |
| 6 | Oprydning + Cloudflare Access-beslutning | Ikke startet. |

### Bugs fundet og rettet undervejs (2026-08-13)

- **Fase 3**: `proxyToGoogle` i `server/routes/calendar.ts` byggede en
  `Response` med tekst-krop ved enhver statuskode — men Google svarer `204
  No Content` ved en vellykket event-sletning, og Fetch-specen forbyder en
  non-null body på en null-body-status. Enhver sletning af en aftale gennem
  serveren ville have fejlet med 500. Rettet ved at sende `null` som body,
  når svaret er tomt.
- **Fase 2**: sletning af et familiemedlem beskyttede det reserverede
  "Familien"-pseudomedlem med `AND id != 'family'` — men medlemmer sås med
  `crypto.randomUUID()`, ikke faste slugs (kan ikke være faste, da
  `family_members.id` er en global primærnøgle på tværs af alle familier).
  Tjekket matchede derfor aldrig noget rigtigt medlem, og pseudomedlemmet var
  reelt ubeskyttet. Rettet til `relation IS NOT NULL`, samme markør resten af
  filen allerede bruger.

Begge blev fundet ved at skrive rute-tests, ikke ved manuel gennemgang —
endnu et argument for at Fase 4 bør have samme behandling, før den merges.

---

## Konkrete næste skridt, i rækkefølge

1. **Afklar Google-samtykke-status** (kun Nicolaj kan gøre dette, se Risiko 1
   nedenfor): er Christine tilføjet som testbruger i Google Cloud Console,
   eller er appen verificeret? Uden det ene eller det andet kan hun ikke
   logge ind, uanset kodens tilstand.
2. **Christine tester Fase 2** på beta (login → indtast kode → se samme
   familie/kalender) → Nicolaj godkender → merge PR #29 til `develop`.
3. **Rigtig beta-test af Fase 3** (forbind, opret/redigér/slet en aftale
   gennem appen, bekræft den rammer den rigtige Google-kalender) → godkend →
   merge PR #28.
4. **Gennemgå og test Fase 4** med samme grundighed som 2/3: rebase oven på
   opdateret `develop`, tilføj tests hvis de mangler, led efter tilsvarende
   bugs.
5. **Designvalg til Fase 5** (kun Nicolaj kan beslutte): skal eksisterende
   lokale aftaler bulk-oprettes automatisk i Google Kalender, eller
   eksporteres som en backup-fil brugeren selv gemmer (genbruger
   `dataBackupStorage.ts`)? Et kort beslutningsoplæg udarbejdes, når vi når
   hertil.
6. **Fase 6**: fjern Cloudflare Access (kun meningsfuldt når app-eget login +
   invitationssystem er betroet, se Risiko 1), ryd op i dødt kode
   (`GoogleCalendarSession`-referencer, `google-calendar-was-connected`),
   opdatér `20_Calendar_Provider_Architecture.md`/`09_Data_Model.md`, bekræft
   Outlook-integrationen fortsat er urørt.

---

## Kendte risici

1. **Googles samtykke-skærm skal formentlig verificeres**, før andre end
   Nicolaj selv kan logge ind uden manuelt at være tilføjet som testbruger i
   Google Cloud Console — kan tage dage-uger. En handling Nicolaj selv skal
   udføre; ikke noget en AI-agent kan gøre. Sandsynligvis den reelle
   blokering for Christines test, uanset kodens tilstand.
2. **Eksisterende Google-forbindelser skal gentvinges**: Google udsteder kun
   en refresh-token ved *første* samtykke pr. bruger+scope, medmindre
   `prompt=consent` tvinges igennem (hvilket koden gør) — alle nuværende
   brugere, inkl. Nicolaj selv, skal derfor logge ind igen under den nye
   flow.
3. **Session-cookiens `Secure`-flag under lokal udvikling** — allerede
   korrekt håndteret i `server/lib/session.ts`s `isSecureRequest()`, som kun
   sætter flaget når requesten reelt kom ind over https. Ingen handling
   nødvendig, nævnt her kun for at bekræfte det er tjekket.
4. D1 i den nuværende skala (få familier) er kapacitetsmæssigt intet
   problem — bevidst overvejet, ikke overset.

---

## Bifangst: Fase 6-indekser allerede tilstede

Den oprindelige plans Fase 6 nævnte tre indekser som udestående arbejde —
alle tre findes allerede i migrationerne, tilføjet undervejs i Fase 1/2 uden
at det var eksplicit planlagt sådan:

- `idx_sessions_user_id` (`0002_auth.sql`)
- `idx_family_memberships_user_id` (`0003_families.sql`)
- `idx_family_members_family_id` (`0003_families.sql`)

---

## Kritiske filer

- `05_App/web/wrangler.jsonc` — fundamentet for hele back-enden (Fase 0).
- `05_App/web/server/routes/calendar.ts` — proxy-laget mod Google (Fase 3).
- `05_App/web/server/routes/families.ts` — familie-/medlemskabs-API'et (Fase 2).
- `05_App/web/src/features/calendar/preferences/familyMembersStorage.ts` —
  formen (`CalendarOwner`, `familyPseudoMemberId`-fallback) D1-endpoints skal
  bevare.
- `05_App/web/src/layouts/AppLayout.tsx` — hvor login- og familie-gates
  sidder, over den eksisterende onboarding-gate.
- `01_Project_Documentation/Architecture/05_ADR_Architecture_Decisions.md` —
  ADR-017.

---

## Verifikation pr. fase

- Fase 2: opret familie, generér invitation, accepter den som en anden
  Google-bruger, bekræft rolle-rettigheder (kun admin/ejer kan fjerne
  medlemmer/omdøbe), test ejerskifte. Automatiseret i
  `server/routes/families.test.ts` — mangler stadig en rigtig anden
  Google-konto (Christine).
- Fase 3: forbind Google, opret/redigér/slet en aftale gennem appen, bekræft
  den rammer den rigtige Google-kalender; test at en tilbagekaldt
  Google-adgang giver en tydelig "forbind igen"-besked. Delvist automatiseret
  i `server/routes/calendar.test.ts` — den rigtige Google-kalender-del kan
  kun bekræftes manuelt på beta.
- Fase 5: migrér Nicolajs nuværende lokale aftaler, bekræft de findes korrekt
  i Google Kalender bagefter, inkl. en gentagen aftale.
- `npm run build && npm run lint && npm run test -- --run` skal være grønne
  efter hver fase.

---

## Dokumentets rolle

Opdateres efter hvert fase-skridt (merge, test, bug fundet/rettet) — så
status her altid afspejler den faktiske tilstand på GitHub, ikke en antaget
tilstand fra en tidligere samtale.
