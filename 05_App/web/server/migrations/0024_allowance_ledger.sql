-- Sprint 39 (se
-- 01_Project_Documentation/Development/39_Sprint39_Lommepenge_Opgavebeloenning_Plan.md):
-- et fast beløb pr. fuldført opgave, med et saldo-overblik pr.
-- familiemedlem. Beløbet sættes pr. opgave (reward_amount), ikke globalt.
--
-- v1-afgrænsning (bevidst mindre end den oprindelige plan): kun almindelige
-- engangsopgaver kan have en belønning i denne omgang — rutineopgaver
-- (task_routine_items) får IKKE et reward_amount-felt her, da UI'et til at
-- sætte det pr. rutinepunkt ikke er bygget i v1. Tilføjes som en separat,
-- selvstændig udvidelse, hvis det efterspørges — undgår et ubrugt
-- skema-felt i mellemtiden.
ALTER TABLE tasks ADD COLUMN reward_amount INTEGER NOT NULL DEFAULT 0;

-- Append-only transaktionslog — saldoen beregnes som SUM(amount) ved
-- forespørgsel, ikke et cachet felt, så log og saldo aldrig kan komme ud
-- af trit. task_id er en LØS reference (ingen fremmednøgle-CASCADE): en
-- slettet opgaves belønningshistorik bevares.
CREATE TABLE allowance_ledger (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  family_member_id TEXT NOT NULL REFERENCES family_members(id),
  amount INTEGER NOT NULL,
  task_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_allowance_ledger_family_member ON allowance_ledger(family_id, family_member_id);

-- Højst én ledger-række pr. opgave: forhindrer at gentagne fuldført/
-- fortryd-klik (eller to samtidige PATCH-kald) bogfører samme belønning
-- flere gange. Rammer kun task-udløste rækker (task_id NOT NULL) — en
-- fremtidig manuel korrektion (task_id NULL) er ikke begrænset af dette.
CREATE UNIQUE INDEX idx_allowance_ledger_task_id ON allowance_ledger(task_id) WHERE task_id IS NOT NULL;
