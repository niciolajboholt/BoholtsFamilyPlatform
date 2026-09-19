import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

const { default: account } = await import("./account");

async function markReauthenticated(env: ReturnType<typeof createFakeEnv>, cookieHeader: string): Promise<void> {
  const sessionId = cookieHeader.replace("session=", "");
  await env.DB.prepare("UPDATE sessions SET reauthenticated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), sessionId)
    .run();
}

function confirmedDeletionRequest(cookieHeader: string): RequestInit {
  return {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "SLET MIN KONTO" }),
  };
}

describe("account routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  it("rejects any request without a session cookie", async () => {
    const response = await account.request("/deletion/preview", {}, env);
    expect(response.status).toBe(401);
  });

  it("preview lists the user's active family memberships", async () => {
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind("family-1", "Testfamilien", userId, now)
      .run();
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    )
      .bind("family-1", userId, now)
      .run();

    const response = await account.request(
      "/deletion/preview",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { memberships: { familyId: string; role: string }[] };
    expect(body.memberships).toEqual([{ familyId: "family-1", familyName: "Testfamilien", role: "owner", memberCount: 1 }]);
  });

  it("refuses a deletion request without a fresh re-authentication", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });

    const response = await account.request(
      "/deletion/request",
      confirmedDeletionRequest(cookieHeader),
      env,
    );

    expect(response.status).toBe(403);
  });

  it("refuses a wrong destructive confirmation after re-authentication", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    await markReauthenticated(env, cookieHeader);

    const response = await account.request(
      "/deletion/request",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "forkert" }),
      },
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_confirmation" });
  });

  it("returns structured guidance when an owner must transfer or delete a family first", async () => {
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "owner-1" });
    const now = new Date().toISOString();
    await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind("family-1", "Testfamilien", userId, now)
      .run();
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    )
      .bind("family-1", userId, now)
      .run();
    await markReauthenticated(env, cookieHeader);

    const response = await account.request(
      "/deletion/request",
      confirmedDeletionRequest(cookieHeader),
      env,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "ownership_transfer_required",
      ownedFamilies: [{ familyId: "family-1", familyName: "Testfamilien", memberCount: 1 }],
    });
  });

  it("accepts a deletion request once the session has a fresh re-authentication, and logs the user out", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    await markReauthenticated(env, cookieHeader);

    const response = await account.request(
      "/deletion/request",
      confirmedDeletionRequest(cookieHeader),
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { purgeAfter: string };
    expect(new Date(body.purgeAfter).getTime()).toBeGreaterThan(Date.now());

    // Sessionen blev slettet af selve sletningsanmodningen — samme cookie
    // kan ikke længere bruges.
    const followUp = await account.request(
      "/deletion/preview",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    expect(followUp.status).toBe(401);
  });

  it("refuses a second open deletion request with a 409", async () => {
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    await markReauthenticated(env, cookieHeader);
    await account.request("/deletion/request", confirmedDeletionRequest(cookieHeader), env);

    // Logget ud efter første anmodning — logger ind igen (ny session) for at
    // forsøge en gentaget anmodning, ligesom en rigtig bruger ville.
    const { cookieHeader: secondCookie } = await seedLoggedInUser(env.DB as never, { id: `${userId}-again` });
    // Simulerer at det er den samme, nu gen-loggede-ind bruger ved at bruge
    // samme userId direkte i stedet for en ny seedet bruger.
    await env.DB.prepare("UPDATE sessions SET user_id = ? WHERE id = ?")
      .bind(userId, secondCookie.replace("session=", ""))
      .run();
    await markReauthenticated(env, secondCookie);

    const response = await account.request(
      "/deletion/request",
      confirmedDeletionRequest(secondCookie),
      env,
    );

    expect(response.status).toBe(409);
  });

  it("returns 404 cancelling when there is no open deletion request", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });

    const response = await account.request(
      "/deletion/cancel",
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("cancels an open deletion request and restores access", async () => {
    const { userId, cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    await markReauthenticated(env, cookieHeader);
    await account.request("/deletion/request", confirmedDeletionRequest(cookieHeader), env);

    // Logger ind igen (ny session) for at fortryde, ligesom planen
    // forudsætter (den gamle session blev slettet af anmodningen selv).
    const { cookieHeader: newCookie } = await seedLoggedInUser(env.DB as never, { id: `${userId}-2` });
    await env.DB.prepare("UPDATE sessions SET user_id = ? WHERE id = ?")
      .bind(userId, newCookie.replace("session=", ""))
      .run();

    const response = await account.request(
      "/deletion/cancel",
      { method: "POST", headers: { Cookie: newCookie } },
      env,
    );

    expect(response.status).toBe(200);

    const user = await env.DB.prepare("SELECT deleted_at AS deletedAt FROM users WHERE id = ?")
      .bind(userId)
      .first<{ deletedAt: string | null }>();
    expect(user?.deletedAt).toBeNull();
  });

  it("rate-limits repeated deletion request attempts", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "user-1" });
    // Uden frisk reauth returnerer hvert kald 403, men tæller stadig med i
    // rate-begrænsningen (checkRateLimit tæller ALLE forsøg).
    for (let i = 0; i < 5; i += 1) {
      const response = await account.request(
        "/deletion/request",
        { method: "POST", headers: { Cookie: cookieHeader } },
        env,
      );
      expect(response.status).toBe(403);
    }

    const sixth = await account.request(
      "/deletion/request",
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
    );

    expect(sixth.status).toBe(429);
  });
});
