// Binding-typen genereres direkte fra wrangler.jsonc i
// worker-configuration.d.ts (`wrangler types`). Aliaset bevarer de
// eksisterende type-imports i serverkoden uden en håndskrevet kopi, der kan
// drive fra den faktiske Cloudflare-konfiguration.
export type Env = Cloudflare.Env;
