-- Sprint 23: Tiimo-inspireret opgaveløsning — engangsopgaver og faste
-- rutiner, personlig (tildelt et familiemedlem) eller familie-rettet
-- (assigned_member_id NULL). Se 23_Sprint23_Opgaver_Plan.md.
--
-- Rutiner genereres dovent: task_routines/task_routine_items er kun
-- skabeloner. Dagens konkrete opgaver oprettes i "tasks" første gang
-- nogen henter dagens liste, ikke af et planlagt baggrundsjob — samme
-- teknik som indkøbslistens auto-oprettede standardliste.

CREATE TABLE task_routines (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES family_members(id),
  weekdays TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_task_routines_family_id ON task_routines(family_id);

CREATE TABLE task_routine_items (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES task_routines(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  time_of_day TEXT,
  sort_order INTEGER NOT NULL
);

CREATE INDEX idx_task_routine_items_routine_id ON task_routine_items(routine_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  assigned_member_id TEXT REFERENCES family_members(id),
  time_of_day TEXT,
  is_done INTEGER NOT NULL DEFAULT 0,
  routine_item_id TEXT REFERENCES task_routine_items(id),
  task_date TEXT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  done_at TEXT
);

CREATE INDEX idx_tasks_family_id_date ON tasks(family_id, task_date);

-- Forhindrer at samme rutine-punkt materialiseres to gange samme dag,
-- selvom flere familiemedlemmer åbner opgavesiden samtidig — et forsøg
-- på at indsætte en duplikat fejler i stedet for at skabe én opgave for
-- meget.
CREATE UNIQUE INDEX idx_tasks_routine_item_date ON tasks(routine_item_id, task_date)
  WHERE routine_item_id IS NOT NULL;
