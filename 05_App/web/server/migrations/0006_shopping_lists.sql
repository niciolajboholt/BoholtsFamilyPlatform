-- Sprint 21, Del B: delt indkøbsliste pr. familie. Bygget til flere
-- navngivne lister fra dag ét (`shopping_lists`), selvom UI'et i første
-- omgang kun viser én — undgår en senere migrering, hvis "flere lister"
-- (Nicolajs eget ønske) implementeres senere.
--
-- `shopping_item_category_overrides` er den selvlærende del af
-- kategoriseringen: en kurateret dansk ordbog (kode, ikke database) giver
-- det første gæt, men når en bruger retter en vares kategori manuelt, huskes
-- rettelsen her og bruges automatisk næste gang samme (normaliserede)
-- varenavn optræder for familien.

CREATE TABLE shopping_lists (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_shopping_lists_family_id ON shopping_lists(family_id);

CREATE TABLE shopping_list_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  added_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  checked_at TEXT
);

CREATE INDEX idx_shopping_list_items_list_id ON shopping_list_items(list_id);

CREATE TABLE shopping_item_category_overrides (
  family_id TEXT NOT NULL REFERENCES families(id),
  item_name_normalized TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (family_id, item_name_normalized)
);
