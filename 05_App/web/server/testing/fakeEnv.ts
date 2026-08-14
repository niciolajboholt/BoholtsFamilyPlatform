// Minimal Env-fixture til rute-/lib-tests: en rigtig fake D1 (se fakeD1.ts)
// plus statisk-værdi-secrets, så koden aldrig behøver skelne test fra drift.

import type { Env } from "../env";
import { createFakeD1 } from "./fakeD1";

// Samme længde som en rigtig AES-GCM-256-nøgle (32 bytes, base64) —
// tokenEncryption.ts fejler ellers på nøglelængden.
export const testGoogleTokenEncryptionKey = Buffer.alloc(32, 7).toString("base64");

export function createFakeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createFakeD1() as unknown as Env["DB"],
    ASSETS: { fetch: () => Promise.resolve(new Response("not used in tests")) } as unknown as Env["ASSETS"],
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: { get: async () => "test-client-secret" } as unknown as Env["GOOGLE_CLIENT_SECRET"],
    GOOGLE_TOKEN_ENCRYPTION_KEY: {
      get: async () => testGoogleTokenEncryptionKey,
    } as unknown as Env["GOOGLE_TOKEN_ENCRYPTION_KEY"],
    ...overrides,
  };
}
