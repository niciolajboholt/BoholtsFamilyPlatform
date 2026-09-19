-- Sprint 50: konto-/familiesletning med to-trins bekræftelse + gen-
-- autentificering og 30 dages fortrydelsesperiode (se
-- 50_Sprint50_Fuld_Dataeksport_Kontosletning_Plan.md og Nicolajs svar på
-- planens fire åbne produktbeslutninger, launch-prep-samtalen).
--
-- deleted_at på users/families er en "skjul med det samme"-markering:
-- sat ved en bekræftet sletningsanmodning, læst af
-- getMembership/getMembershipForFamily (server/lib/familyMembership.ts),
-- så adgangen forsvinder øjeblikkeligt uden at rækkerne rent faktisk
-- fjernes endnu — det sker først ved purge (server/lib/accountDeletion.ts),
-- når fortrydelsesperioden er udløbet.
--
-- En slettet brugers users-række ANONYMISERES ved purge, den fjernes
-- ikke: andre familiemedlemmers opgaver/udgifter oprettet af brugeren skal
-- forblive intakte og vises som "Tidligere medlem" (Nicolajs beslutning),
-- hvilket kræver at created_by_user_id-fremmednøglerne forbliver gyldige.
-- En familiesletning derimod fjerner rent faktisk alle familiens rækker
-- (se hardDeleteFamily) — kun ejeren kan bede om det, og kun efter samme
-- fortrydelsesperiode.
ALTER TABLE users ADD COLUMN deleted_at TEXT;
ALTER TABLE families ADD COLUMN deleted_at TEXT;

-- Gen-autentificering før en destruktiv handling: en frisk OAuth-roundtrip
-- (se auth.ts's /reauth/google og /reauth/microsoft-ruter) opdaterer dette
-- felt på den EKSISTERENDE session i stedet for at oprette en ny — en
-- session-cookie, der kan være op til 30 dage gammel, er ikke i sig selv
-- nok til at bekræfte en sletning (server/lib/accountDeletion.ts's
-- isReauthFresh() kræver at det er sat inden for de seneste minutter).
ALTER TABLE sessions ADD COLUMN reauthenticated_at TEXT;

CREATE TABLE deletion_requests (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('account', 'family')),
  target_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL REFERENCES users(id),
  reauthenticated_at TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  purge_after TEXT NOT NULL,
  cancelled_at TEXT,
  purged_at TEXT
);

CREATE INDEX idx_deletion_requests_target ON deletion_requests(scope, target_id);

-- Højst én ÅBEN (hverken fortrudt eller allerede udført) anmodning pr.
-- konto/familie ad gangen — forhindrer at et dobbeltklik eller en genfremsat
-- anmodning opretter to konkurrerende purge_after-tidspunkter.
CREATE UNIQUE INDEX idx_deletion_requests_open_target
  ON deletion_requests(scope, target_id)
  WHERE cancelled_at IS NULL AND purged_at IS NULL;
