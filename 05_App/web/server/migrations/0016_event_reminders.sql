-- Sprint 31: tidsbaserede påmindelser pr. Google-kalenderaftale ("20 min
-- før", "3 dage før" osv.), sendt via det eksisterende 5-minutters cron-tick
-- (se server/lib/eventReminders.ts og index.ts's scheduled()-handler).
--
-- event_id peger på en Google-aftale via appens egen kodning
-- (google-event:<kalenderId>:<googleEventId>, se googleCalendarIds.ts) — for
-- en gentagende aftale gemmes altid den UDFOLDEDE RÆKKES eget event-id (ikke
-- én bestemt forekomsts), så påmindelsen automatisk følger med til NÆSTE
-- forekomst hvert år (fx en fødselsdag), i stedet for kun at gælde den ene
-- forekomst brugeren stod på, da den blev sat. Selve udledningen sker
-- server-side (se resolveCanonicalEventId i eventReminders-ruten).
--
-- last_sent_occurrence_start husker den seneste forekomst, der er påmindt
-- om — erstatter en fuld sende-log, da kun ÉN forekomst nogensinde er
-- "den næste" ad gangen for en given påmindelse.
CREATE TABLE event_reminders (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  event_id TEXT NOT NULL,
  offset_minutes INTEGER NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_sent_occurrence_start TEXT,
  UNIQUE (family_id, event_id)
);

CREATE INDEX idx_event_reminders_family_id ON event_reminders(family_id);
