-- Sprint 47 (se 47_Sprint47_iCloud_Kalender_CalDAV_Plan.md): iCloud-kalender
-- via CalDAV. I modsætning til Google er der intet OAuth-token at
-- forny — brugeren autentificerer med en Apple "app-specifik
-- adgangskode" (genereret på appleid.apple.com), som krypteres med
-- samme mønster som Googles refresh-token (server/lib/tokenEncryption.ts)
-- før den gemmes.
--
-- Flere familiemedlemmer kan hver forbinde deres egen iCloud-konto
-- (Nicolajs beslutning, se planen) — samme mønster som
-- ics_calendar_subscriptions, ikke Googles enkelt-ejer-model.
CREATE TABLE icloud_calendar_connections (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  apple_id_email TEXT NOT NULL,
  encrypted_app_specific_password TEXT NOT NULL,
  family_member_id TEXT REFERENCES family_members(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_icloud_calendar_connections_family_id ON icloud_calendar_connections(family_id);

-- Én række pr. CalDAV-kalender, appen har opdaget for en forbindelse.
-- ctag ("collection tag") er iCloud's modstykke til Googles syncToken:
-- uændret ctag betyder ingen ændringer siden sidste synk, og cron'en
-- kan nøjes med et let PROPFIND i stedet for en fuld REPORT-forespørgsel
-- (se planens afsnit om lærdommen fra Google-token-hændelsen).
CREATE TABLE icloud_calendar_sync_state (
  connection_id TEXT NOT NULL REFERENCES icloud_calendar_connections(id),
  caldav_calendar_url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  ctag TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (connection_id, caldav_calendar_url)
);
