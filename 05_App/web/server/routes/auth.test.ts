import { describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedUser } from "../testing/fakeD1";

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
