-- Sprint 38: måltidsplanlægning — en ugeplan (dato -> ret), der kan
-- generere indkøbsliste-varer automatisk via det eksisterende AI-modul
-- (generateIngredientsDraft, se aiAssistant.ts). Familie-fælles, ikke
-- personligt tildelt en enkelt person — samme antagelse som selve
-- indkøbslisten (se 38_Sprint38_Maaltidsplanlaegning_Plan.md).
--
-- UNIQUE(family_id, date): præcis én ret pr. dag i v1 — at sætte en ny
-- ret for en dato, der allerede har én, erstatter den (se PUT-ruten),
-- ikke en liste af flere retter samme dag.
CREATE TABLE meal_plan_entries (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  date TEXT NOT NULL,
  dish_name TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (family_id, date)
);

CREATE INDEX idx_meal_plan_entries_family_id_date ON meal_plan_entries(family_id, date);
