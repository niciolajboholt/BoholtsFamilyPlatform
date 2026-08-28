-- Privatlivskontrol for det automatiske AI-ugeresumé. Eksisterende familier
-- beholder funktionen, men ejer/admin kan slå den fra i Indstillinger.
ALTER TABLE families ADD COLUMN ai_weekly_summary_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (ai_weekly_summary_enabled IN (0, 1));
