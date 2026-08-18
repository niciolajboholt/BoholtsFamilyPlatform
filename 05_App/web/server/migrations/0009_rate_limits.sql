-- Sprint 24: generisk rate-limit-tæller til D1, brugt til at afvise for
-- mange forsøg mod følsomme ruter (fx invite-accept) inden for et kort
-- tidsvindue. "scope" adskiller forskellige rutens brug af den samme tabel
-- (fx "invite-accept"), "key" er hvem der begrænses (i dag: bruger-id).
CREATE TABLE rate_limit_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_rate_limit_attempts_scope_key_time
  ON rate_limit_attempts (scope, key, created_at);
