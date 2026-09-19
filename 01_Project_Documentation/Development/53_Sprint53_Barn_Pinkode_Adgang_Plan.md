# 53_Sprint53_Barn_Pinkode_Adgang_Plan

Version: 1.0

Project:
Boholts Family Platform (Hjemmecentralen)

Last Updated:
2026-09-19

Owner:
Nicolaj Bach Boholt

Maintained by:
Claude

Status:
Implementeret 2026-09-19. Fase 3 af `51_Barnets_Hjemmecentral_Plan.md`
("sikker børneadgang") — bygget oven på Sprint 52's "Mit i dag".

---

## Formål

Lade et barn selv åbne "Mit i dag" på sin EGEN, aldrig-loggede-ind enhed
(egen tablet/telefon) via et link + en 4-cifret PIN-kode — uden Google-,
Microsoft- eller iCloud-login, og uden en ny, fuld kontotype.

---

## Beslutning (samtale med Nicolaj, 2026-09-19)

Der var to mulige enheds-modeller: (A) PIN-koden er kun en genvej på en
enhed hvor en forælder allerede er logget ind, eller (B) PIN-koden giver
adgang på en helt ny, ikke-logget-ind enhed. **Nicolaj valgte (B).**

Det betyder PIN-koden alene IKKE er nok som hemmelighed (kun 10.000
kombinationer, og en enhed uden forælder-login har ingen familie at slå
PIN-koden op i). Løsningen er derfor to faktorer:

1. **Et per-barn adgangslink** (`child_access_token`, 32 tilfældige bytes,
   samme styrke som `family_share_links.token`) — identificerer PRÆCIS
   familien og barnet. Genereres af ejer/admin under "Rediger
   familiemedlem" og deles med barnet (kopiér link).
2. **En 4-cifret PIN**, egen pr. barn (ikke fælles familiekode, jf.
   tidligere svar) — tjekkes KUN efter linket allerede er kendt, og er
   strengt rate-begrænset (se nedenfor).

Dette er et helt nyt, letvægts autentificerings-lag — bevidst ADSKILT fra
den almindelige `users`/`sessions`-model (et barn har intet `users.id`).

---

## Teknisk løsning

### Data (migration 0032)

- `family_members.child_access_token`, `pin_hash`, `pin_set_at` (alle
  nullable — børneadgang er valgfri pr. medlem).
- `child_sessions` (id, family_member_id, created_at, expires_at) — egen
  tabel, egen cookie (`child_session`), 30 dages levetid (samme bekvem
  levetid som en almindelig session — beskyttelsen ligger i at OPRETTE
  sessionen kræver link+PIN, ikke i selve sessionens levetid).
- PIN gemmes som `<salt>:<PBKDF2-hash>` (`server/lib/pinHashing.ts`).
  PBKDF2 er et ekstra lag, ikke den primære beskyttelse — med kun 10.000
  mulige PIN-koder er den REELLE beskyttelse (a) det ugættelige
  `child_access_token`, som skal kendes FØRST, og (b) hård
  rate-begrænsning af selve verificerings-ruten (6 forsøg / 15 minutter,
  nøglet på token — samme mønster som øvrige følsomme ruter, Sprint 24).
- `child_access_token` er UNIK og gemmes i klartekst, samme konvention
  som `family_share_links.token` — ikke hemmeligere at læse end at dele.

### Server

- `GET /api/child/access/:token` (offentlig): viser barnets navn/farve,
  UDEN at kræve PIN endnu — så enheden kan vise "Hej, Frida!" før
  kode-indtastning.
- `POST /api/child/access/:token/verify` (offentlig, rate-begrænset):
  verificerer PIN, opretter en `child_sessions`-række + cookie.
- `GET /api/child/me`, `GET /api/child/today`, `POST /api/child/tasks/:id/done`,
  `POST /api/child/logout` (kræver gyldig `child_session`-cookie) — kun
  DENNE ene barns egne opgaver kan læses/afkrydses; ruten tjekker
  eksplicit at opgavens `assigned_member_id` matcher sessionens medlem.
  Genbruger `setTaskDone()` (udtrukket fra `tasksCrud.ts` til
  `lib/taskCompletion.ts`), så lommepenge-bogføring opfører sig identisk
  med den almindelige Opgaver-side.
- `POST/DELETE /api/families/:id/members/:memberId/child-access` og
  `PUT .../pin` (ejer/admin, håndhævet server-side — samme mønster som
  resten af familiens indstillinger, ingen ekstra klient-side rolletjek,
  jf. eksisterende konvention i `FamilySection.tsx`/`FamilyMemberDialog.tsx`).

### Klient

- `FamilyMemberDialog.tsx` får en ny sektion: generér/rotér adgangslink
  (kopiér-knap), sæt/fjern PIN.
- Ny side `/barn/:token` (uden for `AppLayout`, samme mønster som
  `/kiosk` og `/share/:token`): viser barnets navn, et 4-cifret PIN-tastatur,
  og derefter en LÅST "Mit i dag"-visning (ingen navigation til resten af
  appen) med kun det barnets egne dagens opgaver + en "Log ud"-knap.

---

## Eksplicit afgrænset i denne omgang

- **Ingen kalenderaftaler i børneadgangens "Mit i dag"** — kun opgaver.
  At vise Google/Outlook/iCloud-aftaler kræver at låne en VOKSENS
  OAuth-token server-side (se `calendar.ts`: kalenderdata hentes i dag
  altid med DEN INDLOGGEDE brugers eget token) og genimplementere
  klientens aftale-udvidelses-/redigeringslogik server-side for en
  u-autentificeret session — en selvstændig, større opgave, IKKE lavet
  her. Barnets "Mit i dag" viser derfor kun "Næste opgave" og dagens
  øvrige opgaver, ikke aftaler, indtil dette besluttes og bygges separat.
- **Ingen "billedbaseret" alternativ til PIN** — kun 4-cifret talkode,
  jf. tidligere svar.
- **Intet UI for at se/administrere aktive børne-sessioner** (fx "log alle
  børn ud") — kun revokering ved at rotere linket eller fjerne PIN-koden,
  hvilket sletter alle den enheds aktive sessioner med det samme.

---

## Teststrategi

- `pinHashing.test.ts`: hash/verify rundtur, forkert PIN afvises,
  forskellige salt for samme PIN.
- `childAccess.test.ts` (ruter): token-opslag, forkert/rigtig PIN,
  rate-begrænsning, session-cookie giver adgang til `/today`/`/tasks/:id/done`
  men KUN for egne opgaver (403/404 på en anden opgave), `/logout` rydder
  sessionen.
- `childAccessManagement.test.ts`: kun ejer/admin kan generere link/sætte
  PIN, rotation ugyldiggør det gamle link.
- `accountDeletion.test.ts` udvidet: `hardDeleteFamily()` rydder
  `child_sessions` FØR `family_members`, uden fremmednøgle-fejl.
