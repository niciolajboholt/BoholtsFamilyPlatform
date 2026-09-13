-- Retter en reel driftsfejl (2026-09-12): getGoogleAccessToken() cachede
-- aldrig adgangstokenet — den kaldte Googles refresh-endpoint OG skrev
-- last_refreshed_at til D1 ved HVERT ENESTE kald, der havde brug for
-- kalenderdata (cron hvert 5. minut + enhver rigtig sideindlæsning),
-- selvom adgangstokenet er gyldigt i ~1 time. Det udløste 100.000+
-- D1-skrivninger på én dag og blokerede Cloudflares gratis skriveloft for
-- hele kontoen. cached_access_token/access_token_expires_at lader
-- getGoogleAccessToken genbruge tokenet, indtil det reelt er ved at
-- udløbe, i stedet for at ramme Google og D1 ved hvert kald.
ALTER TABLE google_connections ADD COLUMN cached_access_token TEXT;
ALTER TABLE google_connections ADD COLUMN access_token_expires_at TEXT;
