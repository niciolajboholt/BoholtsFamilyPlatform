-- Sprint 22: understøtter flere navngivne indkøbslister med en fast type
-- (dagligvarer/byggemarked/andet), der styrer hvilket kategorisæt og
-- hvilken nøgleords-ordbog listen bruger (se
-- 22_Sprint22_Flere_Indkoebslister_Plan.md).

ALTER TABLE shopping_lists ADD COLUMN type TEXT NOT NULL DEFAULT 'dagligvarer';

-- SQLite/D1 kan ikke ændre en PRIMARY KEY in-place — tabellen genskabes
-- med list_type tilføjet til nøglen. Alle eksisterende rækker stammer fra
-- Sprint 21, hvor der kun fandtes dagligvarer-lister, og migreres som
-- sådan.
CREATE TABLE shopping_item_category_overrides_new (
  family_id TEXT NOT NULL REFERENCES families(id),
  list_type TEXT NOT NULL,
  item_name_normalized TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (family_id, list_type, item_name_normalized)
);

INSERT INTO shopping_item_category_overrides_new
  (family_id, list_type, item_name_normalized, category)
SELECT family_id, 'dagligvarer', item_name_normalized, category
FROM shopping_item_category_overrides;

DROP TABLE shopping_item_category_overrides;

ALTER TABLE shopping_item_category_overrides_new RENAME TO shopping_item_category_overrides;
