import { describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser, seedUser } from "../testing/fakeD1";

vi.mock("../lib/microsoftOAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/microsoftOAuth")>();
  return {
    ...actual,
    exchangeMicrosoftAuthorizationCode: vi.fn(),
    fetchMicrosoftUserInfo: vi.fn(),
  };
});

const { exchangeMicrosoftAuthorizationCode, fetchMicrosoftUserInfo } = await import(
  "../lib/microsoftOAuth"
);
const exchangeMock = vi.mocked(exchangeMicrosoftAuthorizationCode);
const userInfoMock = vi.mocked(fetchMicrosoftUserInfo);

const auth = (await import("./auth")).default;

function extractFlowCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("forventede en oauth_flow-cookie");
  const match = /oauth_flow=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("oauth_flow-cookie ikke fundet i Set-Cookie");
  return `oauth_flow=${match[1]}`;
}

describe("/microsoft/begin", () => {
  it("omdirigerer til Microsofts 'consumers'-tenant autoriserings-endpoint", async () => {
    const env = createFakeEnv();

    const response = await auth.request("/microsoft/begin", {}, env);

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const url = new URL(location!);
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe(env.MICROSOFT_CLIENT_ID);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(response.headers.get("set-cookie")).toContain("Path=/auth/microsoft");
  });
});

describe("/microsoft/callback", () => {
  it("afviser en request uden code/state/cookie", async () => {
    const env = createFakeEnv();
    const response = await auth.request("/microsoft/callback", {}, env);
    expect(response.status).toBe(400);
  });

  it("opretter en ny bruger med en 'ms:'-præfikset google_sub-placeholder", async () => {
    const env = createFakeEnv();

    const beginResponse = await auth.request("/microsoft/begin", {}, env);
    const flowCookie = extractFlowCookie(beginResponse);
    const state = new URL(beginResponse.headers.get("location")!).searchParams.get("state");

    exchangeMock.mockResolvedValue({
      access_token: "fake-access-token",
      expires_in: 3600,
      scope: "openid email profile",
      token_type: "Bearer",
    });
    userInfoMock.mockResolvedValue({
      sub: "ms-sub-123",
      email: "familie@outlook.com",
      name: "Familie Medlem",
    });

    const response = await auth.request(
      `/microsoft/callback?code=fake-code&state=${state}`,
      { headers: { Cookie: flowCookie } },
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");

    const row = await env.DB.prepare(
      "SELECT google_sub AS googleSub, microsoft_sub AS microsoftSub, email FROM users WHERE microsoft_sub = ?",
    )
      .bind("ms-sub-123")
      .first<{ googleSub: string; microsoftSub: string; email: string }>();

    expect(row).toEqual({
      googleSub: "ms:ms-sub-123",
      microsoftSub: "ms-sub-123",
      email: "familie@outlook.com",
    });
  });

  it("genkender en eksisterende microsoft-bruger i stedet for at oprette en ny", async () => {
    const env = createFakeEnv();
    await seedUser(env.DB as never, {
      id: "existing-user",
      microsoftSub: "ms-sub-456",
      email: "gammel@outlook.com",
      name: "Gammelt Navn",
    });

    const beginResponse = await auth.request("/microsoft/begin", {}, env);
    const flowCookie = extractFlowCookie(beginResponse);
    const state = new URL(beginResponse.headers.get("location")!).searchParams.get("state");

    exchangeMock.mockResolvedValue({
      access_token: "fake-access-token",
      expires_in: 3600,
      scope: "openid email profile",
      token_type: "Bearer",
    });
    userInfoMock.mockResolvedValue({
      sub: "ms-sub-456",
      email: "nyt@outlook.com",
      name: "Nyt Navn",
    });

    await auth.request(
      `/microsoft/callback?code=fake-code&state=${state}`,
      { headers: { Cookie: flowCookie } },
      env,
    );

    const { results } = await env.DB.prepare(
      "SELECT id FROM users WHERE microsoft_sub = ?",
    )
      .bind("ms-sub-456")
      .all();

    expect(results).toHaveLength(1);

    const row = await env.DB.prepare(
      "SELECT id AS id, email FROM users WHERE microsoft_sub = ?",
    )
      .bind("ms-sub-456")
      .first<{ id: string; email: string }>();

    expect(row?.id).toBe("existing-user");
    expect(row?.email).toBe("nyt@outlook.com");
  });
});

// Sprint 50: gen-autentificering før kontosletning — se
// server/lib/accountDeletion.ts's header-kommentar. Genbruger Microsoft-
// mocken ovenfor (samme udbyder-uafhængige begin/callback-form som
// /google og /microsoft).
describe("/reauth/microsoft/begin", () => {
  it("kræver en eksisterende session", async () => {
    const env = createFakeEnv();
    const response = await auth.request("/reauth/microsoft/begin", {}, env);
    expect(response.status).toBe(401);
  });

  it("omdirigerer til Microsofts autoriserings-endpoint for en logget ind bruger", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "user-1",
      microsoftSub: "ms-sub-1",
    });

    const response = await auth.request(
      "/reauth/microsoft/begin",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).toContain("Path=/auth/reauth/microsoft");
  });
});

describe("/reauth/microsoft/callback", () => {
  it("markerer sessionen som gen-autentificeret, når identiteten matcher den nuværende bruger", async () => {
    const env = createFakeEnv();
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "user-1",
      microsoftSub: "ms-sub-1",
    });

    const beginResponse = await auth.request(
      "/reauth/microsoft/begin",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const flowCookie = extractFlowCookie(beginResponse);
    const state = new URL(beginResponse.headers.get("location")!).searchParams.get("state");

    exchangeMock.mockResolvedValue({
      access_token: "fake-access-token",
      expires_in: 3600,
      scope: "openid email profile",
      token_type: "Bearer",
    });
    userInfoMock.mockResolvedValue({ sub: "ms-sub-1", email: "user1@example.com", name: "Bruger" });

    const response = await auth.request(
      `/reauth/microsoft/callback?code=fake-code&state=${state}`,
      { headers: { Cookie: `${cookieHeader}; ${flowCookie}` } },
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/settings?reauth=success");

    const session = await env.DB.prepare(
      "SELECT reauthenticated_at AS reauthenticatedAt FROM sessions WHERE user_id = ?",
    )
      .bind(userId)
      .first<{ reauthenticatedAt: string | null }>();
    expect(session?.reauthenticatedAt).not.toBeNull();
  });

  it("afviser og markerer IKKE sessionen, hvis den bekræftede identitet er en anden konto", async () => {
    const env = createFakeEnv();
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "user-1",
      microsoftSub: "ms-sub-1",
    });
    await seedUser(env.DB as never, { id: "other-user", microsoftSub: "ms-sub-other" });

    const beginResponse = await auth.request(
      "/reauth/microsoft/begin",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const flowCookie = extractFlowCookie(beginResponse);
    const state = new URL(beginResponse.headers.get("location")!).searchParams.get("state");

    exchangeMock.mockResolvedValue({
      access_token: "fake-access-token",
      expires_in: 3600,
      scope: "openid email profile",
      token_type: "Bearer",
    });
    // Brugeren bekræfter som en ANDEN konto end den, der er logget ind.
    userInfoMock.mockResolvedValue({ sub: "ms-sub-other", email: "other@example.com", name: "Anden" });

    const response = await auth.request(
      `/reauth/microsoft/callback?code=fake-code&state=${state}`,
      { headers: { Cookie: `${cookieHeader}; ${flowCookie}` } },
      env,
    );

    expect(response.status).toBe(403);

    const session = await env.DB.prepare(
      "SELECT reauthenticated_at AS reauthenticatedAt FROM sessions WHERE user_id = ?",
    )
      .bind(userId)
      .first<{ reauthenticatedAt: string | null }>();
    expect(session?.reauthenticatedAt).toBeNull();
  });

  it("afviser hvis sessionen er væk, når callbacket rammer", async () => {
    const env = createFakeEnv();
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, {
      id: "user-1",
      microsoftSub: "ms-sub-1",
    });

    const beginResponse = await auth.request(
      "/reauth/microsoft/begin",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const flowCookie = extractFlowCookie(beginResponse);
    const state = new URL(beginResponse.headers.get("location")!).searchParams.get("state");

    await auth.request("/logout", { method: "POST", headers: { Cookie: cookieHeader } }, env);

    const response = await auth.request(
      `/reauth/microsoft/callback?code=fake-code&state=${state}`,
      { headers: { Cookie: `${cookieHeader}; ${flowCookie}` } },
      env,
    );

    expect(response.status).toBe(401);
  });
});
