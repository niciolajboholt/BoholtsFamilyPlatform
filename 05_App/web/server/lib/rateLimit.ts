// Sprint 24: generisk D1-baseret rate-limiter — se migration 0009. Bruges
// først af invite-accept (families.ts), men "scope" gør den genanvendelig
// for andre følsomme ruter uden en ny tabel pr. rute.

interface RateLimitOptions {
  scope: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
}

// Registrerer ét forsøg og afgør, om det er inden for grænsen. Tæller ALLE
// forsøg (også afviste), så et vedholdende forsøg ikke selv kan "skubbe
// vinduet" ved at blive ved med at prøve.
export async function checkRateLimit(
  db: D1Database,
  options: RateLimitOptions,
): Promise<{ allowed: boolean }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.windowMs).toISOString();

  const { count } = (await db
    .prepare(
      `SELECT COUNT(*) AS count FROM rate_limit_attempts
       WHERE scope = ? AND key = ? AND created_at > ?`,
    )
    .bind(options.scope, options.key, windowStart)
    .first<{ count: number }>()) ?? { count: 0 };

  await db
    .prepare("INSERT INTO rate_limit_attempts (scope, key, created_at) VALUES (?, ?, ?)")
    .bind(options.scope, options.key, now.toISOString())
    .run();

  return { allowed: count < options.maxAttempts };
}

// Rydder gamle forsøg op, så tabellen ikke vokser ubegrænset — kaldes fra
// samme daglige Cron Trigger som cleanupExpiredSessions() (index.ts).
export async function cleanupOldRateLimitAttempts(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  await db.prepare("DELETE FROM rate_limit_attempts WHERE created_at < ?").bind(cutoff).run();
}
