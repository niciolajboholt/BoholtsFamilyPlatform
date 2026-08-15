-- Fase 2: familier, medlemskab og invitationer. "families" har præcis én
-- ejer (owner_user_id); "family_memberships" udtrykker rolle for enhver
-- bruger i familien, inkl. ejeren selv (role='owner'), så rolle-tjek altid
-- kan gå gennem én tabel. "family_invites" er engangs-/genbrugelige koder
-- (kan regenereres, revoked_at sat i stedet for slettet, så gamle koder ikke
-- kan genbruges af et link der lå i en gammel besked). "family_members"
-- er familiens synlige medlemsliste (voksne+børn), svarer til dagens
-- CalendarOwner — linked_user_id er NULL for børn (ingen egen konto).

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE family_memberships (
  family_id TEXT NOT NULL REFERENCES families(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX idx_family_memberships_user_id ON family_memberships(user_id);

CREATE TABLE family_invites (
  code TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX idx_family_invites_family_id ON family_invites(family_id);

CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  relation TEXT,
  is_placeholder_name INTEGER NOT NULL DEFAULT 0,
  linked_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_family_members_family_id ON family_members(family_id);
