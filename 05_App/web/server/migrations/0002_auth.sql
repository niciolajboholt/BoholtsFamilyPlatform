-- Fase 1: identitet, session og Google-forbindelse. "users" er hvem der er
-- logget ind med Google; "sessions" er den enkelte browser-sessions
-- cookie-værdi; "google_connections" gemmes allerede her (login beder om
-- kalender-scopes i samme samtykke), men bruges først til reel synkronisering
-- i Fase 3. Familie/medlemskab kommer i 0003 (Fase 2).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE google_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  encrypted_refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  last_refreshed_at TEXT
);
