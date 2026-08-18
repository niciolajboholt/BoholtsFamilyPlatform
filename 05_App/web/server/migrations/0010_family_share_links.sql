-- Sprint 26: read-only delelink til familiens kalender for udenforstående
-- (fx bedsteforældre) uden login. Kun ét link ad gangen pr. familie (samme
-- "revoked_at i stedet for slettet"-mønster som family_invites, så et
-- gammelt link ikke kan genopstå). token er langt/tilfældigt (32 bytes,
-- base64url) — i modsætning til family_invites.code (et menneske taster
-- den ind) er dette link beregnet til at blive kopieret/delt direkte.
-- created_by_user_id er det familiemedlem, hvis Google-forbindelse driver
-- linket (appen understøtter endnu ikke flere Google-konti pr. familie).
-- included_member_ids er en kommasepareret liste af family_members.id
-- (samme CSV-mønster som task_routines.weekdays) — hvilke familiemedlemmers
-- kalendere linket viser, opslået dynamisk mod calendar_member_mappings
-- ved hvert kald, ikke et statisk snapshot.

CREATE TABLE family_share_links (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  token TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  included_member_ids TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_family_share_links_family_id ON family_share_links(family_id);
