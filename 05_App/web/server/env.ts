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
}
