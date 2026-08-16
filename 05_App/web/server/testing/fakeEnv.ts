// Minimal Env-fixture til rute-/lib-tests: en rigtig fake D1 (se fakeD1.ts)
// plus statisk-værdi-secrets, så koden aldrig behøver skelne test fra drift.

import type { Env } from "../env";
import { createFakeD1 } from "./fakeD1";

// Samme længde som en rigtig AES-GCM-256-nøgle (32 bytes, base64) —
// tokenEncryption.ts fejler ellers på nøglelængden.
export const testGoogleTokenEncryptionKey = Buffer.alloc(32, 7).toString("base64");

// Et rigtigt, gyldigt VAPID-nøglepar (genereret én gang via
// web-push-browsers egen generateVapidKeys/serializeVapidKeys) — et
// vilkårligt base64url-tal ville ikke deserialisere som et gyldigt
// EC-nøglepar, og pushNotifications.ts's tests skal kunne kalde den rigtige
// krypteringssti, ikke en mock af den.
export const testVapidPublicKey =
  "BMzDnFt0l5jcko0iMkfbN6xg4k7KtVnvQybf3IvAoyjhehc2om4B8axcag_9YWMw0L1_yszV8p8hP4eVnHZxlpc";
export const testVapidPrivateKey =
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgire2f9ixKfrAOMs6pDmx9WBIQDacVrHEXAvkHMx8RcWhRANCAATMw5xbdJeY3JKNIjJH2zesYOJOyrVZ70Mm39yLwKMo4XoXNqJuAfGsXGoP_WFjMNC9f8rM1fKfIT-HlZx2cZaX";

export function createFakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createFakeD1() as unknown as Env["DB"],
    ASSETS: { fetch: () => Promise.resolve(new Response("not used in tests")) } as unknown as Env["ASSETS"],
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: { get: async () => "test-client-secret" } as unknown as Env["GOOGLE_CLIENT_SECRET"],
    GOOGLE_TOKEN_ENCRYPTION_KEY: {
      get: async () => testGoogleTokenEncryptionKey,
    } as unknown as Env["GOOGLE_TOKEN_ENCRYPTION_KEY"],
    VAPID_PUBLIC_KEY: testVapidPublicKey,
    VAPID_PRIVATE_KEY: {
      get: async () => testVapidPrivateKey,
    } as unknown as Env["VAPID_PRIVATE_KEY"],
    VAPID_SUBJECT: "mailto:test@example.com",
    ...overrides,
  };
}
