-- Sprint 40 (se
-- 01_Project_Documentation/Development/40_Sprint40_Foedselsdag_Gaveplanlaegning_Plan.md):
-- gaveideer og budget knyttet til familiemedlemmers fødselsdage.
--
-- RETTELSE til den oprindelige udbygningsplan: fødselsdage fandtes IKKE
-- som data i forvejen (family_members havde intet dato-felt) — dette
-- felt er derfor nyt her, ikke en udnyttelse af eksisterende data.
--
-- birthday er "MM-DD" (ingen år) — bevidst valg, se planens åbne
-- spørgsmål: appen viser derfor "har fødselsdag om N dage", ikke
-- "bliver N år", da fødselsåret ikke er relevant for gaveplanlægning og
-- er en mere følsom oplysning end nødvendigt at bede om.
ALTER TABLE family_members ADD COLUMN birthday TEXT;

-- year er en del af nøglen (sammen med family_member_id), så gaveideer
-- for samme person ikke blandes sammen år efter år.
CREATE TABLE birthday_gift_plans (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  year INTEGER NOT NULL,
  gift_idea TEXT NOT NULL,
  budget_amount INTEGER,
  is_purchased INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_birthday_gift_plans_member_year
  ON birthday_gift_plans(family_member_id, year);
