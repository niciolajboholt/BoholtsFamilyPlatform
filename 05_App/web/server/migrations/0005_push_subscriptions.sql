-- Sprint 21, Del A: Web Push (VAPID)-abonnementer. Et device = én
-- subscription (samme bruger kan have flere: telefon + computer).
-- "endpoint" er push-tjenestens egen unikke URL for netop dette device og
-- er derfor UNIQUE — et gentaget subscribe-kald fra samme device (fx efter
-- en service worker-opdatering) skal opdatere nøglerne, ikke oprette en
-- dublet.

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
