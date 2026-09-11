-- Sprint 33-følgeret: "Alle ændringer" viste hverken dato (rettet i
-- 0021's følgekode) eller hvilket familiemedlems kalender en ny/flyttet/
-- aflyst aftale kom fra — calendar_activity_log gemte det slet ikke.
-- google_calendar_id gemmes nu pr. logrække, så activity.ts kan slå
-- ejeren op mod calendar_member_mappings ved læsning (samme JOIN-mønster
-- som googleCalendarAggregation.ts allerede bruger) — uden at
-- denormalisere selve medlemsnavnet ind i loggen, så en senere
-- navneændring eller ny kalender-tildeling altid slår korrekt igennem
-- på historiske rækker.
ALTER TABLE calendar_activity_log ADD COLUMN google_calendar_id TEXT;
