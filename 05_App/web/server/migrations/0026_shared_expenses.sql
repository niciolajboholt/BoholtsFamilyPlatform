-- Sprint 41 (se
-- 01_Project_Documentation/Development/41_Sprint41_Deleoekonomi_Foraeldre_Plan.md):
-- et simpelt "hvem betalte/hvem skylder"-overblik mellem forældre for
-- fælles udgifter — bevidst IKKE fuld bogføring.
--
-- split_between er et JSON-array af family_member_id'er, ikke en separat
-- kobletabel: antallet af deltagere pr. udgift er lille (typisk 1-2
-- voksne) og skal ikke selvstændigt forespørges. Beløbet deles ligeligt
-- mellem dem i v1 — ingen vægtet/ulige fordeling, se plandokumentets
-- begrundelse.
CREATE TABLE shared_expenses (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_by_member_id TEXT NOT NULL REFERENCES family_members(id),
  split_between TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_shared_expenses_family ON shared_expenses(family_id);

-- Append-only udligningslog, samme princip som allowance_ledger (Sprint
-- 39): "marker som afregnet" for et par medlemmer indsætter én række, der
-- modsvarer den aktuelt viste saldo mellem dem, så den beregnede saldo
-- (se sharedExpenses.ts's beregning) falder tilbage til 0 — uden at røre
-- de oprindelige shared_expenses-rækker, og uden nogen rigtig
-- pengeoverførsel (kun et overblik, jf. plandokumentets pkt. 5).
CREATE TABLE shared_expense_settlements (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  debtor_member_id TEXT NOT NULL REFERENCES family_members(id),
  creditor_member_id TEXT NOT NULL REFERENCES family_members(id),
  amount INTEGER NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_shared_expense_settlements_family ON shared_expense_settlements(family_id);
