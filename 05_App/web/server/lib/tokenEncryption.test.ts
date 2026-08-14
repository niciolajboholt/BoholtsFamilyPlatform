import { describe, expect, it } from "vitest";

import { decryptRefreshToken, encryptRefreshToken } from "./tokenEncryption";
import { testGoogleTokenEncryptionKey } from "../testing/fakeEnv";

describe("tokenEncryption", () => {
  it("round-trips a refresh token", async () => {
    const plaintext = "1//09-a-real-looking-refresh-token";

    const encrypted = await encryptRefreshToken(plaintext, testGoogleTokenEncryptionKey);
    const decrypted = await decryptRefreshToken(encrypted, testGoogleTokenEncryptionKey);

    expect(decrypted).toBe(plaintext);
  });

  it("never reuses the IV, so the same plaintext encrypts differently each time", async () => {
    const plaintext = "same-refresh-token";

    const first = await encryptRefreshToken(plaintext, testGoogleTokenEncryptionKey);
    const second = await encryptRefreshToken(plaintext, testGoogleTokenEncryptionKey);

    expect(first).not.toBe(second);
  });

  it("fails to decrypt with the wrong key", async () => {
    const wrongKey = Buffer.alloc(32, 9).toString("base64");
    const encrypted = await encryptRefreshToken("secret", testGoogleTokenEncryptionKey);

    await expect(decryptRefreshToken(encrypted, wrongKey)).rejects.toThrow();
  });

  it("rejects a malformed encrypted string", async () => {
    await expect(
      decryptRefreshToken("not-a-valid-iv-and-ciphertext-pair", testGoogleTokenEncryptionKey),
    ).rejects.toThrow("Ugyldigt krypteret refresh-token-format.");
  });
});
