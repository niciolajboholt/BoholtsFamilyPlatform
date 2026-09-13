import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMicrosoftAuthorizeUrl, fetchMicrosoftUserInfo } from "./microsoftOAuth";

describe("buildMicrosoftAuthorizeUrl", () => {
  it("bruger 'consumers'-tenanten, så kun personlige Microsoft-konti kan logge ind", () => {
    const url = new URL(
      buildMicrosoftAuthorizeUrl({
        clientId: "client-1",
        redirectUri: "https://example.dk/auth/microsoft/callback",
        state: "state-1",
        codeChallenge: "challenge-1",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.dk/auth/microsoft/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("fetchMicrosoftUserInfo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bruger preferred_username som e-mail-reserve, hvis email mangler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sub: "sub-1",
            preferred_username: "person@outlook.com",
          }),
          { status: 200 },
        ),
      ),
    );

    const userInfo = await fetchMicrosoftUserInfo("fake-token");

    expect(userInfo).toEqual({
      sub: "sub-1",
      email: "person@outlook.com",
      name: "person@outlook.com",
      picture: undefined,
    });
  });

  it("kaster en fejl hvis svaret hverken har email eller preferred_username", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ sub: "sub-2" }), { status: 200 }),
      ),
    );

    await expect(fetchMicrosoftUserInfo("fake-token")).rejects.toThrow(
      "Microsoft userinfo-svar manglede e-mail",
    );
  });
});
