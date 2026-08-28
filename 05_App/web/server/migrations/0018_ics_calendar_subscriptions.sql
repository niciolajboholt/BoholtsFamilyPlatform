-- Fase 9: en delt kalender tilføjet via et ICS-link (Googles "hemmelige
-- iCal-adresse", Outlooks offentlige kalenderlink, en skole-/idrætskalender
-- osv.) — skrivebeskyttet, ingen OAuth til kildens konto. calendar_member_
-- mappings kan ikke bære url/label/hentnings-status, og et ICS-abonnement
-- er ikke en Google-/Outlook-kalender opdaget via en konto-forbindelse, så
-- det får sin egen tabel i stedet for at presses ind i den eksisterende.
--
-- url gemmes i klartekst for v1 (bevidst produktbeslutning, 2026-08-28,
-- Nicolaj) — ikke krypteret som Googles OAuth-refresh-token i users-
-- tabellen. server/lib/tokenEncryption.ts's AES-GCM-implementering er
-- generisk nok til at genbruge her, hvis en senere sikkerhedsgennemgang
-- anbefaler det.
--
-- family_member_id er valgfri (NULL = ikke tildelt en bestemt person endnu)
-- i modsætning til calendar_member_mappings, hvor tildelingen er selve
-- formålet med rækken.
--
-- Loftet på 5 abonnementer pr. familie håndhæves i applikationslaget
-- (samme sted som andre forretningsregler i denne kodebase, fx invite-
-- accept-raten i familyCore.ts), ikke i skemaet.

CREATE TABLE ics_calendar_subscriptions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  family_member_id TEXT REFERENCES family_members(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  last_fetched_at TEXT,
  last_fetch_status TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_ics_calendar_subscriptions_family_id ON ics_calendar_subscriptions(family_id);
