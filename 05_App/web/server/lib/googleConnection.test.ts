import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv, testGoogleTokenEncryptionKey } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";
import { encryptRefreshToken } from "./tokenEncryption";

vi.mock("./googleOAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./googleOAuth")>();
  return { ...actual, refreshGoogleAccessToken: vi.fn() };
});

const { refreshGoogleAccessToken, GoogleRefreshTokenInvalidError } = await import("./googleOAuth");
const { getGoogleAccessToken, GoogleNotConnectedError } = await import("./googleConnection");

const refreshGoogleAccessTokenMock = vi.mocked(refreshGoogleAccessToken);

async function seedConnection(env: ReturnType<typeof createFakeEnv>, userId: string): Promise<void> {
  const encrypted = await encryptRefreshToken("a-real-refresh-token", testGoogleTokenEncryptionKey);

  await env.DB.prepare(
    "INSERT INTO google_connections (user_id, encrypted_refresh_token, scope, connected_at) VALUES (?, ?, ?, ?)",
  )
    .bind(userId, encrypted, "calendar.events", new Date().toISOString())
    .run();
}

describe("getGoogleAccessToken", () => {
  beforeEach(() => {
    refreshGoogleAccessTokenMock.mockReset();
  });

  it("throws GoogleNotConnectedError when the user never connected Google", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });

    await expect(getGoogleAccessToken(env, "user-1")).rejects.toThrow(GoogleNotConnectedError);
  });

  it("decrypts the stored refresh token, exchanges it, and returns the access token", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });
    await seedConnection(env, "user-1");

    refreshGoogleAccessTokenMock.mockResolvedValue({
      access_token: "fresh-access-token",
      expires_in: 3600,
      scope: "calendar.events",
      token_type: "Bearer",
    });

    const accessToken = await getGoogleAccessToken(env, "user-1");

    expect(accessToken).toBe("fresh-access-token");
    expect(refreshGoogleAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "a-real-refresh-token" }),
    );

    const row = await env.DB.prepare(
      "SELECT last_refreshed_at AS lastRefreshedAt FROM google_connections WHERE user_id = ?",
    )
      .bind("user-1")
      .first<{ lastRefreshedAt: string | null }>();
    expect(row?.lastRefreshedAt).not.toBeNull();
  });

  it("clears the connection and throws GoogleNotConnectedError when the refresh token was revoked", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });
    await seedConnection(env, "user-1");

    refreshGoogleAccessTokenMock.mockRejectedValue(new GoogleRefreshTokenInvalidError());

    await expect(getGoogleAccessToken(env, "user-1")).rejects.toThrow(GoogleNotConnectedError);

    const row = await env.DB.prepare("SELECT user_id FROM google_connections WHERE user_id = ?")
      .bind("user-1")
      .first();
    expect(row).toBeNull();
  });

  it("propagates unexpected errors without clearing the connection", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, { id: "user-1" });
    await seedConnection(env, "user-1");

    refreshGoogleAccessTokenMock.mockRejectedValue(new Error("Google er nede"));

    await expect(getGoogleAccessToken(env, "user-1")).rejects.toThrow("Google er nede");

    const row = await env.DB.prepare("SELECT user_id FROM google_connections WHERE user_id = ?")
      .bind("user-1")
      .first();
    expect(row).not.toBeNull();
  });
});
