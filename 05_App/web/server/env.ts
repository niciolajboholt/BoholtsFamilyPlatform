// Samlet liste over alle Worker-bindinger (D1, secrets, statiske filer) —
// ét sted, så nye ruter/lib-moduler altid importerer den samme type.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Ikke-hemmelig — samme værdi som VITE_GOOGLE_CLIENT_ID i klienten. Sat
  // direkte i wrangler.jsonc's "vars", ikke i dashboardets "Variables and
  // Secrets" under Settings — den sektion viste sig kun at gælde
  // build-processen, aldrig den kørende Worker (se ADR-017/Fase 1-noter).
  GOOGLE_CLIENT_ID: string;
  // Hemmelige — bindes via Cloudflares "Secrets Store" (Bindings-fanen), af
  // samme grund som ovenfor. Kræver .get() i stedet for direkte brug som
  // streng. Findes i Google Cloud Console under OAuth-klienten.
  GOOGLE_CLIENT_SECRET: SecretsStoreSecret;
  // 32 tilfældige bytes, base64-kodet — genereres én gang, bruges til at
  // kryptere Googles refresh-token før det gemmes i D1 (se tokenEncryption.ts).
  GOOGLE_TOKEN_ENCRYPTION_KEY: SecretsStoreSecret;
  // Sprint 21, Del A: VAPID-nøglepar til Web Push. Den offentlige nøgle er
  // IKKE hemmelig (klienten skal kende den, for at kunne abonnere via
  // PushManager) — kun den private nøgle går gennem Secrets Store.
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: SecretsStoreSecret;
  // Kontakt-adgang push-tjenester (Google/Apple/Mozillas) kan bruge, hvis de
  // skal nå appens ejer om et misbrugt/fejlkonfigureret abonnement — krævet
  // af VAPID-specifikationen, skal være "mailto:" eller "https://".
  VAPID_SUBJECT: string;
  // Sprint 23: AI-modul (rutine- og ingrediens-forslag). Cloudflare Workers
  // AI, ikke en ekstern udbyder — data forlader ikke Cloudflares egen
  // infrastruktur, og der er ingen API-nøgle at opsætte (se
  // 23_Sprint23_Opgaver_Plan.md).
  AI: Ai;
  // Sprint 30: hvem der må se den indsendte feedback (routes/feedback.ts) —
  // sammenlignes mod den loggede brugers e-mail. Ikke-hemmelig, samme
  // mønster som GOOGLE_CLIENT_ID/VAPID_SUBJECT ovenfor.
  ADMIN_EMAIL: string;
  // Sprint 30 (tilføjelse): API-nøgle til Resend (lib/email.ts), som sender
  // ADMIN_EMAIL en mail hver gang der kommer ny feedback. Hemmelig, samme
  // mønster som GOOGLE_CLIENT_SECRET ovenfor — bindes via Secrets Store.
  RESEND_API_KEY: SecretsStoreSecret;
}
