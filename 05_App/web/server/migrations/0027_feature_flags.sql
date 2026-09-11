-- Nicolaj bad om at kunne slå de nyere, valgfrie funktioner (Sprint 38-41,
-- 43) til/fra pr. familie under Indstillinger, i stedet for at de altid er
-- synlige for alle familier. Præsens af en række = funktionen er aktiveret
-- — ingen "enabled"-boolean-kolonne nødvendig, samme mønster som
-- allowance_ledger/shared_expense_settlements. Alle familier (nye som
-- eksisterende) starter uden nogen rækker, dvs. alt er slået fra som
-- udgangspunkt, indtil nogen aktiverer det via "Flere funktioner".
CREATE TABLE family_enabled_features (
  family_id TEXT NOT NULL REFERENCES families(id),
  feature_key TEXT NOT NULL,
  enabled_by_user_id TEXT NOT NULL,
  enabled_at TEXT NOT NULL,
  PRIMARY KEY (family_id, feature_key)
);
