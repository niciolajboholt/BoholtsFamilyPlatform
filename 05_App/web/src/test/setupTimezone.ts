// The all-day-event timezone bugs (fixed in Sprint 12.1) only surfaced in a
// timezone ahead of UTC. Pinning TZ here means the regression tests actually
// cover Denmark's real timezone instead of silently passing under UTC.
process.env.TZ = "Europe/Copenhagen";
