import { describe, expect, it } from "vitest";

import { derivePkceChallenge, generateOAuthState, generatePkceVerifier } from "./oauthPkce";

describe("oauthPkce", () => {
  it("genererer forskellige, URL-sikre verifiers og states hver gang", () => {
    const verifier1 = generatePkceVerifier();
    const verifier2 = generatePkceVerifier();
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();

    expect(verifier1).not.toBe(verifier2);
    expect(state1).not.toBe(state2);

    for (const value of [verifier1, verifier2, state1, state2]) {
      expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("afleder samme challenge for samme verifier (S256), forskellig for forskellige verifiers", async () => {
    const verifier = generatePkceVerifier();

    const challengeA = await derivePkceChallenge(verifier);
    const challengeB = await derivePkceChallenge(verifier);
    const challengeC = await derivePkceChallenge(generatePkceVerifier());

    expect(challengeA).toBe(challengeB);
    expect(challengeA).not.toBe(challengeC);
    expect(challengeA).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
