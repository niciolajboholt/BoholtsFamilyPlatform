# 09 - Data Model

**Projekt:** Boholts Family Platform

**Version:** 0.2 — opdateret Sprint 20 (ADR-017): familie-, medlems- og
kalender-tildelingsdata flyttet fra device-lokal `localStorage` til
server-ejet D1. Selve aftalerne (events) er IKKE en del af D1 — de bor
udelukkende hos den eksterne kalenderudbyder (Google/Outlook), jf. Fase 5's
fjernelse af det lokale aftale-lag.

---

# Family

D1-tabel: `families`.

Indeholder:

- ID
- Navn
- Oprettet-tidspunkt

Har mange `Family Membership`-rækker (brugere) og `Family Member`-profiler
(kalender-deltagere).

---

# Family Membership

D1-tabel: `family_memberships`. Kobler en logget-ind bruger (`users`, Google-
identitet) til en familie.

Felter:

- Bruger-ID
- Familie-ID
- Rolle

Roller:

- Owner (præcis én pr. familie, kan overdrages)
- Admin
- Member

---

# Family Member

D1-tabel: `family_members`. En kalender-deltager-profil — IKKE nødvendigvis
en logget-ind bruger (børn har fx ingen egen konto).

Felter:

- ID (global UUID — se ADR om scoping-tjek ved enhver ny rute, der bruger den)
- Familie-ID
- Navn
- Farve
- Relation

Relation:

- Far / Mor / Barn / …
- `NULL` er reserveret til familiens delte pseudo-profil ("Familien") —
  klienten oversætter dette id til det faste lokale `familyPseudoMemberId`
  ("family"), se `familyMembersSync.ts`.

---

# Calendar Member Mapping

D1-tabel: `calendar_member_mappings` (Fase 4). Kobler én ekstern kalender
til ét familiemedlem — delt af hele familien, ikke device-lokal.

Felter:

- Familie-ID
- Google/Outlook kalender-ID (rå, udbyder-specifikt)
- Familiemedlem-ID

---

# Event

Findes IKKE i D1 — ejes udelukkende af den eksterne kalenderudbyder. Appens
`CalendarEvent`-model (klient-side) er en normaliseret visning af udbyderens
data, ikke egen lagring.

Felter (normaliseret model):

- Titel
- Starttid / sluttid
- Deltagere (afledt af Calendar Member Mapping, ikke gemt pr. event)
- Kilde (`sourceId`, præfikset `google:` eller `outlook:`)

---

# Calendar Source

Muligheder:

- Google
- Outlook
- Apple (reserveret, ikke implementeret)

`Internal` (device-lokal, ikke-Google) fandtes indtil Fase 5 (Sprint 20) —
fjernet, da alle aftaler nu kræver en ekstern, forbundet kalender.
