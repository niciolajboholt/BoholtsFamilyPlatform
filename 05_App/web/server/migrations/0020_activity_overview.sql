-- Sprint 33: "Siden sidst du var her" — se
-- 01_Project_Documentation/Development/33_Sprint33_Siden_Sidst_Plan.md.
--
-- user_activity_cursors erstatter en tidligere overvejet "sidste
-- session"-baseline: sessions oprettes kun ved et reelt Google-login og
-- lever 30 dage uden fornyelse, så den ville vise en stadig ældre
-- "siden sidst" for en bruger, der åbner appen dagligt uden at logge ud.
-- Cursoren opdateres i stedet eksplicit via GET .../since-last-visit
-- (ingen aktivitet -> rykkes med det samme) og POST .../acknowledge
-- (aktivitet fundet -> rykkes først når brugeren har set kortet).
CREATE TABLE user_activity_cursors (
  user_id TEXT NOT NULL REFERENCES users(id),
  family_id TEXT NOT NULL REFERENCES families(id),
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, family_id)
);

-- calendar_sync_state og calendar_event_snapshots holder den server-side
-- tilstand, en inkrementel Google-synk kræver (samme grundmekanisme som
-- Sprint 25's klient-cache, men her drevet af cron'en, ikke en bestemt
-- browser). Et ukendt/udløbet syncToken udløser en bootstrap-synk (se
-- calendarActivitySync.ts): snapshottet genopbygges, men INGEN rækker
-- skrives til calendar_activity_log for den omgang — ellers ville enten
-- lanceringen eller enhver 410-Gone-håndtering klassificere samtlige
-- eksisterende aftaler som "nye".
CREATE TABLE calendar_sync_state (
  google_calendar_id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  sync_token TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_calendar_sync_state_family_id ON calendar_sync_state(family_id);

-- safe_title/is_private kommer altid fra getSafeGoogleEventDetails()
-- (server/lib/googleCalendarPrivacy.ts) — den rå Google-titel for en
-- privat/fortrolig aftale forlader aldrig kalenderintegrationslaget og
-- havner derfor aldrig i vores egen database.
CREATE TABLE calendar_event_snapshots (
  google_calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  safe_title TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  PRIMARY KEY (google_calendar_id, event_id)
);

-- Append-only aktivitetslog, som "Siden sidst"-endpointet filtrerer på
-- detected_at > brugerens cursor. source_updated_at er Googles eget
-- opdateringstidspunkt for eventet (til fejlsøgning); detected_at er
-- hvornår cron'en faktisk registrerede ændringen, og er den, der styrer
-- hvad brugeren ser. Ryddes efter 90 dage af det eksisterende daglige
-- cleanup-cron (se cleanupOldCalendarActivity i lib/calendarActivitySync.ts).
CREATE TABLE calendar_activity_log (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'moved', 'cancelled')),
  safe_title TEXT NOT NULL,
  old_start TEXT,
  new_start TEXT,
  source_updated_at TEXT,
  detected_at TEXT NOT NULL
);

CREATE INDEX idx_calendar_activity_log_family_id_detected_at
  ON calendar_activity_log(family_id, detected_at);
