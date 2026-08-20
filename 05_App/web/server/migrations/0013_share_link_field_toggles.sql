-- Sprint 29: offentlige delelinks viste hidtil altid aftalens beskrivelse
-- og lokation, uden at forklare hvilke oplysninger der reelt bliver
-- delt med en udenforstående. Begge felter er nu tilvalg, slået fra som
-- standard — kun titel/tidspunkt vises, medmindre familien aktivt vælger
-- at inkludere dem.
ALTER TABLE family_share_links ADD COLUMN include_description INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_share_links ADD COLUMN include_location INTEGER NOT NULL DEFAULT 0;
