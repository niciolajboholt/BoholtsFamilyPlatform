// Samlet liste over alle Worker-bindinger (D1, secrets, statiske filer) —
// ét sted, så nye ruter/lib-moduler altid importerer den samme type.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Ikke-hemmelig — samme værdi som VITE_GOOGLE_CLIENT_ID i klienten, sat som
  // en almindelig Worker-variabel (Cloudflare-dashboard → Settings →
  // Variables and Secrets).
  GOOGLE_CLIENT_ID: string;
  // Hemmelige — sættes som "Secret" (krypteret), ikke "Variable", i samme
  // dashboard-sektion. Findes i Google Cloud Console under OAuth-klienten.
  GOOGLE_CLIENT_SECRET: string;
  // 32 tilfældige bytes, base64-kodet — genereres én gang, bruges til at
  // kryptere Googles refresh-token før det gemmes i D1 (se tokenEncryption.ts).
  GOOGLE_TOKEN_ENCRYPTION_KEY: string;
}
