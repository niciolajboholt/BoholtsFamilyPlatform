-- Sprint 28: AI-genereret ugeresumé. week_start er ugens mandag
-- (YYYY-MM-DD, Europe/Copenhagen — samme tidszonelogik som Sprint 27's
-- taskReminders.ts). Én gemt opsummering pr. familie pr. uge (unikt
-- indeks) — genereres ikke på ny, hvis en for ugen allerede findes, så
-- gentagne visninger ikke bruger Workers AI-budget unødigt.

CREATE TABLE family_weekly_summaries (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  week_start TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_family_weekly_summaries_family_week
  ON family_weekly_summaries(family_id, week_start);
