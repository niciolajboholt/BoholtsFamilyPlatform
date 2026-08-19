-- Sprint 27: tidsbaserede opgave-påmindelser. reminded_at er sat, når en
-- push-notifikation er sendt for opgavens time_of_day — forhindrer at
-- samme opgave får en påmindelse sendt to gange (fx hvis cron-jobbet af en
-- eller anden grund skulle køre to gange inden for samme 5-minutters
-- vindue).
ALTER TABLE tasks ADD COLUMN reminded_at TEXT;
