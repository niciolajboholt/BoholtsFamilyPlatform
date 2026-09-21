import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../../testing/fakeEnv";
import { seedLoggedInUser } from "../../testing/fakeD1";

// Importeret via det samlede families-router (samme konvention som
// familyDeletion.test.ts) — dækker også den delte session-middleware.
const { default: families } = await import("../families");

interface FamilyMemberJson {
  id: string;
  relation: string | null;
}

interface CreateFamilyResponse {
  family: { id: string };
  inviteCode: string;
  members: FamilyMemberJson[];
}

// familySeed.ts's familyMemberSeeds bruger faste "id"-værdier (fx "barn-1")
// kun som seed-reference — de rigtige family_members.id'er er
// crypto.randomUUID(), så testen skal slå det rigtige id op via relationen
// i stedet for at antage et fast id.
async function createFamilyWithChild(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
): Promise<{
  familyId: string;
  inviteCode: string;
  childMemberId: string;
  familyPseudoMemberId: string;
  adultMemberId: string;
}> {
  const response = await families.request(
    "/",
    { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json" } },
    env,
  );
  const body: CreateFamilyResponse = await response.json();
  const child = body.members.find((member) => member.relation === "Barn");
  const pseudo = body.members.find((member) => member.relation === null);
  const adult = body.members.find((member) => member.relation === "Far");

  if (!child || !pseudo || !adult) {
    throw new Error("test setup: expected a seeded child member, an adult member, and family pseudo-member");
  }

  return {
    familyId: body.family.id,
    inviteCode: body.inviteCode,
    childMemberId: child.id,
    familyPseudoMemberId: pseudo.id,
    adultMemberId: adult.id,
  };
}

describe("child access management routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  describe("GET /:id/members/:memberId/child-access", () => {
    it("starts with no token and no PIN for a freshly seeded child member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ token: null, hasPin: false, pinSetAt: null });
    });

    it("rejects a plain member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access`,
        { headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("returns 404 for an unknown member id", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/does-not-exist/child-access`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });

    it("returns 404 for the family pseudo-member (relation IS NULL)", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.familyPseudoMemberId}/child-access`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });

    // Sprint 57: bekræfter rettelsen af den server-side hul, hvor børneadgang
    // tidligere kunne aktiveres for en voksen (relation != NULL, men også
    // != 'Barn') — se plandokumentets afsnit A.
    it("returns 404 for an adult member (relation = 'Far')", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.adultMemberId}/child-access`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST /:id/members/:memberId/child-access/token", () => {
    it("refuses to generate a token for an adult member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.adultMemberId}/child-access/token`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });

    it("generates an unguessable token", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body = await response.json<{ token: string }>();

      expect(response.status).toBe(200);
      expect(body.token.length).toBeGreaterThan(20);

      const status = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await status.json()).token).toBe(body.token);
    });

    it("rotating the token invalidates the old one and clears active child sessions", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const first = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
          { method: "POST", headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ token: string }>();

      await env.DB.prepare(
        "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
        .bind(
          "child-session-1",
          created.childMemberId,
          new Date().toISOString(),
          new Date(Date.now() + 100_000).toISOString(),
        )
        .run();

      const second = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
          { method: "POST", headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ token: string }>();

      expect(second.token).not.toBe(first.token);

      const remainingSessions = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM child_sessions WHERE family_member_id = ?",
      )
        .bind(created.childMemberId)
        .first<{ count: number }>();
      expect(remainingSessions?.count).toBe(0);
    });
  });

  describe("PUT /:id/members/:memberId/child-access/pin", () => {
    it("rejects setting a PIN before a token exists", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: "1234" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("rejects a malformed PIN", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: "12" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("sets the PIN once a token exists", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: "1234" }),
        },
        env,
      );

      expect(response.status).toBe(200);

      const status = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ hasPin: boolean; pinSetAt: string | null }>();
      expect(status.hasPin).toBe(true);
      expect(status.pinSetAt).not.toBeNull();
    });
  });

  describe("DELETE /:id/members/:memberId/child-access/pin", () => {
    it("clears the PIN and any active child sessions without removing the token", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const token = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
          { method: "POST", headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ token: string }>();
      await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: "1234" }),
        },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);

      const status = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ token: string | null; hasPin: boolean }>();
      expect(status.token).toBe(token.token);
      expect(status.hasPin).toBe(false);
    });
  });

  describe("DELETE /:id/members/:memberId/child-access/token", () => {
    it("clears both the token and the PIN", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/pin`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ pin: "1234" }),
        },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/token`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);

      const status = await (
        await families.request(
          `/${created.familyId}/members/${created.childMemberId}/child-access`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        )
      ).json<{ token: string | null; hasPin: boolean }>();
      expect(status.token).toBeNull();
      expect(status.hasPin).toBe(false);
    });
  });

  describe("child-access/sessions", () => {
    it("rejects a non-owner/admin member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions`,
        { headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("lists active sessions with created/last-seen timestamps", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 100_000).toISOString();

      await env.DB.prepare(
        "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind("session-1", created.childMemberId, now, future, now)
        .run();

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body = await response.json<{ sessions: { id: string; createdAt: string; lastSeenAt: string | null }[] }>();

      expect(response.status).toBe(200);
      expect(body.sessions).toEqual([{ id: "session-1", createdAt: now, lastSeenAt: now }]);
    });

    it("does not list an expired session", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const past = new Date(Date.now() - 100_000).toISOString();

      await env.DB.prepare(
        "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
        .bind("expired-session", created.childMemberId, past, past)
        .run();

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect((await response.json<{ sessions: unknown[] }>()).sessions).toEqual([]);
    });

    it("'log out on all devices' removes every session for that member only", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const future = new Date(Date.now() + 100_000).toISOString();

      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        ).bind("session-1", created.childMemberId, new Date().toISOString(), future),
        env.DB.prepare(
          "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        ).bind("session-2", created.childMemberId, new Date().toISOString(), future),
        env.DB.prepare(
          "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        ).bind("other-member-session", created.familyPseudoMemberId, new Date().toISOString(), future),
      ]);

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);

      const remaining = await env.DB.prepare("SELECT id FROM child_sessions").all<{ id: string }>();
      expect(remaining.results.map((row) => row.id)).toEqual(["other-member-session"]);
    });

    it("logs out a single device by id, and 404s for an unknown session id", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const future = new Date(Date.now() + 100_000).toISOString();

      await env.DB.prepare(
        "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
        .bind("session-1", created.childMemberId, new Date().toISOString(), future)
        .run();

      const missing = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions/does-not-exist`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(missing.status).toBe(404);

      const response = await families.request(
        `/${created.familyId}/members/${created.childMemberId}/child-access/sessions/session-1`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(response.status).toBe(200);

      const remaining = await env.DB.prepare("SELECT id FROM child_sessions").all<{ id: string }>();
      expect(remaining.results).toEqual([]);
    });
  });
});
