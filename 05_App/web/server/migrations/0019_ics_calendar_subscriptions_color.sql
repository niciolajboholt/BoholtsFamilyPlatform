-- Fase 9: valgfri, familie-valgt farve for et ICS-abonnement. Bruges kun når
-- abonnementet IKKE er tildelt et familiemedlem — et tildelt medlems egen
-- farve vinder altid (samme fortrin som Google-/Outlook-kalendere, ADR-014).
-- Nullable og uden format-/enum-tjek, samme princip som family_members.color
-- (server/routes/familyRoutes/familyMembers.ts validerer kun ikke-tom streng,
-- intet hex-/enum-krav) — klienten tilbyder et fast swatch-sæt
-- (familyMemberColorSwatches.ts), men skemaet håndhæver det ikke.

ALTER TABLE ics_calendar_subscriptions ADD COLUMN color TEXT;
