-- Sprint 53 (se 53_Sprint53_Barn_Pinkode_Adgang_Plan.md, fase 3 af
-- 51_Barnets_Hjemmecentral_Plan.md): PIN-kodet børneadgang på en helt ny,
-- ikke-logget-ind enhed — Nicolajs beslutning var at et barns EGEN
-- tablet/telefon skal kunne åbne "Mit i dag" kun via link + PIN, ikke blot
-- en genvej på en forælders allerede-loggede-ind session. Det kræver et
-- nyt, letvægts sessions-begreb, ADSKILT fra den almindelige
-- users/sessions-model (et barn uden konto har intet users.id).
--
-- child_access_token er den reelle hemmelighed (32 tilfældige bytes,
-- samme styrke som family_share_links.token, gemt i klartekst efter samme
-- konvention) — PIN-koden alene ville være gættelig på tværs af ALLE
-- familier (kun 10.000 kombinationer). PIN'en er derfor kun et andet trin,
-- EFTER man allerede har det ugættelige link, og beskyttes i praksis af
-- rate-begrænsningen på selve verificerings-ruten, ikke af hash-styrken
-- alene (se lib/pinHashing.ts).
ALTER TABLE family_members ADD COLUMN child_access_token TEXT;
ALTER TABLE family_members ADD COLUMN pin_hash TEXT;
ALTER TABLE family_members ADD COLUMN pin_set_at TEXT;

CREATE UNIQUE INDEX idx_family_members_child_access_token
  ON family_members(child_access_token)
  WHERE child_access_token IS NOT NULL;

-- Egen sessionstabel, egen cookie (se lib/childSession.ts) — et barns
-- session kan ikke ligge i den almindelige "sessions"-tabel, som er
-- nøglet til users.id.
CREATE TABLE child_sessions (
  id TEXT PRIMARY KEY,
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_child_sessions_member_id ON child_sessions(family_member_id);
