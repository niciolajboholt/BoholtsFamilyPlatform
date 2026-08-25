-- Sprint 31: genbrugelige indkøbsliste-skabeloner. En skabelon er et
-- navngivet, familie-delt snapshot af varenavne (ingen kategori gemt —
-- kategorien slås op igen via resolveCategory() ved anvendelse, så en
-- efterfølgende rettelse af selvlæringen automatisk slår igennem på næste
-- brug af skabelonen). Bundet til én listetype, ligesom
-- shopping_item_category_overrides, da kategoriseringen er type-afhængig.

CREATE TABLE shopping_list_templates (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  list_type TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_shopping_list_templates_family_id ON shopping_list_templates(family_id);

CREATE TABLE shopping_list_template_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES shopping_list_templates(id),
  name TEXT NOT NULL
);

CREATE INDEX idx_shopping_list_template_items_template_id ON shopping_list_template_items(template_id);
