-- Sprint 55 (se 55_Sprint55_Barn_Adgang_UX_Plan.md): udbygger Sprint 53's
-- børneadgang med et sessionsoverblik og en minimal besked-funktion.
--
-- last_seen_at opdateres ved HVERT autentificeret børneadgangs-kald (se
-- lib/childSession.ts's getChildSessionMember) — bevidst KUN et
-- tidsstempel, ingen IP eller enhedsinformation, jf. planens eksplicitte
-- "mindst mulig datamængde"-beslutning.
ALTER TABLE child_sessions ADD COLUMN last_seen_at TEXT;

-- Korte, envejs beskeder fra en voksen til ét bestemt familiemedlem (v1 —
-- se planens afgrænsning: ingen billeder/filer/links, intet svar fra
-- barnet, ingen automatisk udløb).
CREATE TABLE child_messages (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX idx_child_messages_member ON child_messages(family_member_id, created_at);
