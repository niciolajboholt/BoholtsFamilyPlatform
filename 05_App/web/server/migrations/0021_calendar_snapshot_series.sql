-- Sprint 33-følgeret: en gentagende aftales forekomster kan dukke op i
-- Googles delta-synk fordelt over FLERE separate 5-minutters-tick — det
-- tidligere in-memory-dedup (loggedCreatedSeriesIds i
-- calendarActivitySync.ts) nulstilledes ved hvert kald og opdagede derfor
-- kun dubletter INDEN FOR ét enkelt tick, ikke på tværs af dem. Symptom i
-- produktion: samme gentagende aftale ("Håndbold") logget som "ny" flere
-- gange i calendar_activity_log. recurring_event_id gemmes nu på hvert
-- snapshot, så et senere tick kan slå op, om serien allerede er set
-- (uanset hvornår), i stedet for kun at huske det aktuelle tick.
ALTER TABLE calendar_event_snapshots ADD COLUMN recurring_event_id TEXT;

CREATE INDEX idx_calendar_event_snapshots_series
  ON calendar_event_snapshots(google_calendar_id, recurring_event_id);
