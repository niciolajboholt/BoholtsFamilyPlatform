-- Fase 4: kalender-til-familiemedlem-tildeling (ADR-014, "denne kalender
-- tilhører Alfred") er reel delt familiedata, ikke en enheds-præference —
-- flyttes fra localStorage til D1, familie-scoped, så alle familiens
-- enheder ser samme tildeling uden hver især at skulle sætte den op.
--
-- calendarSourceVisibilityStorage.ts og googleCalendarExclusionStorage.ts
-- forbliver bevidst lokale (device-præference, ikke familiedata) — kun
-- selve medlems-tildelingen flytter.

CREATE TABLE calendar_member_mappings (
  family_id TEXT NOT NULL REFERENCES families(id),
  google_calendar_id TEXT NOT NULL,
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  PRIMARY KEY (family_id, google_calendar_id)
);
