-- Sprint 30: enkel feedback-kanal — en logget-ind bruger kan sende en kort
-- besked til appens ejer via Indstillinger, uden at det kræver en ekstern
-- mail-tjeneste. Ikke familie-scopet (feedback hører til afsenderen, ikke
-- en bestemt familie) — kun ADMIN_EMAIL (env.ts) må læse listen, se
-- routes/feedback.ts.

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT,
  created_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_feedback_created_at ON feedback(created_at);
