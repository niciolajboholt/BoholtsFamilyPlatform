import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../../testing/fakeEnv";
import { seedLoggedInUser } from "../../testing/fakeD1";

// Importeret via det samlede families-router (ikke familyDeletion.ts
// direkte), så testene også dækker den delte session-middleware i
// families.ts og den families.deleted_at-baserede skjulning i
// lib/familyMembership.ts, som ALLE familie-ruter er afhængige af.
const { default: families } = await import("../families");

async function markReauthenticated(env: ReturnType<typeof createFakeEnv>, cookieHeader: string): Promise<void> {
  const sessionId = cookieHeader.replace("session=", "");
  await env.DB.prepare("UPDATE sessions SET reauthenticated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), sessionId)
    .run();
}

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  ownerUserId: string,
  memberUserIds: string[] = [],
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Testfamilien", ownerUserId, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
  )
    .bind(familyId, ownerUserId, now)
    .run();
  for (const userId of memberUserIds) {
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
    )
      .bind(familyId, userId, now)
      .run();
  }
}

async function seedFamilyMember(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  memberId: string,
  linkedUserId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, is_placeholder_name, linked_user_id, created_at)
     VALUES (?, ?, 'Medlem', '#fff', 0, ?, ?)`,
  )
    .bind(memberId, familyId, linkedUserId, new Date().toISOString())
    .run();
}

describe("family export + deletion routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  describe("GET /:id/export", () => {
    it("returns 404 for a family the user does not belong to", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "outsider" });

      const response = await families.request(
        "/some-family/export",
        { headers: { Cookie: cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });

    it("gives the owner the full family export, including other members' emails", async () => {
      const { userId: ownerId, cookieHeader: ownerCookie } = await seedLoggedInUser(env.DB as never, {
        id: "owner-1",
      });
      const { userId: memberUserId } = await seedLoggedInUser(env.DB as never, {
        id: "member-1",
        email: "member@example.com",
      });
      await seedFamily(env, "family-1", ownerId, [memberUserId]);
      await seedFamilyMember(env, "family-1", "fm-1", memberUserId);
      await env.DB.prepare(
        "INSERT INTO tasks (id, family_id, name, icon, created_by_user_id, created_at) VALUES ('task-1', ?, 'Task', 'icon', ?, ?)",
      )
        .bind("family-1", memberUserId, new Date().toISOString())
        .run();

      const response = await families.request(
        "/family-1/export",
        { headers: { Cookie: ownerCookie } },
        env,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        scope: string;
        memberships: { email: string }[];
        tasks: { id: string }[];
      };
      expect(body.scope).toBe("family");
      expect(body.memberships.map((m) => m.email)).toContain("member@example.com");
      expect(body.tasks.map((t) => t.id)).toContain("task-1");
    });

    it("gives a plain member only their own data, not other members' emails", async () => {
      const { userId: ownerId } = await seedLoggedInUser(env.DB as never, { id: "owner-1" });
      const { userId: memberUserId, cookieHeader: memberCookie } = await seedLoggedInUser(env.DB as never, {
        id: "member-1",
      });
      await seedFamily(env, "family-1", ownerId, [memberUserId]);
      await seedFamilyMember(env, "family-1", "fm-member", memberUserId);

      const response = await families.request(
        "/family-1/export",
        { headers: { Cookie: memberCookie } },
        env,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as { scope: string; user: { id: string } | null };
      expect(body.scope).toBe("member");
      expect(body.user?.id).toBe(memberUserId);
      // Et almindeligt medlems eksport har ingen "memberships"/"members"-felt
      // med andre brugeres oplysninger overhovedet.
      expect(body).not.toHaveProperty("memberships");
    });
  });

  describe("family deletion (owner only)", () => {
    it("refuses a plain member's deletion preview/request", async () => {
      const { userId: ownerId } = await seedLoggedInUser(env.DB as never, { id: "owner-1" });
      const { userId: memberUserId, cookieHeader: memberCookie } = await seedLoggedInUser(env.DB as never, {
        id: "member-1",
      });
      await seedFamily(env, "family-1", ownerId, [memberUserId]);

      const preview = await families.request(
        "/family-1/deletion/preview",
        { headers: { Cookie: memberCookie } },
        env,
      );
      expect(preview.status).toBe(403);

      const request = await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: memberCookie } },
        env,
      );
      expect(request.status).toBe(403);
    });

    it("refuses an owner's deletion request without a fresh re-authentication", async () => {
      const { userId: ownerId, cookieHeader: ownerCookie } = await seedLoggedInUser(env.DB as never, {
        id: "owner-1",
      });
      await seedFamily(env, "family-1", ownerId);

      const response = await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("hides the family from every member immediately once the owner confirms deletion", async () => {
      const { userId: ownerId, cookieHeader: ownerCookie } = await seedLoggedInUser(env.DB as never, {
        id: "owner-1",
      });
      const { cookieHeader: memberCookie, userId: memberUserId } = await seedLoggedInUser(env.DB as never, {
        id: "member-1",
      });
      await seedFamily(env, "family-1", ownerId, [memberUserId]);
      await markReauthenticated(env, ownerCookie);

      const requestResponse = await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );
      expect(requestResponse.status).toBe(200);

      const ownerView = await families.request("/family-1", { headers: { Cookie: ownerCookie } }, env);
      expect(ownerView.status).toBe(404);

      const memberView = await families.request("/family-1", { headers: { Cookie: memberCookie } }, env);
      expect(memberView.status).toBe(404);
    });

    it("lets only the requesting owner cancel, restoring access for everyone", async () => {
      const { userId: ownerId, cookieHeader: ownerCookie } = await seedLoggedInUser(env.DB as never, {
        id: "owner-1",
      });
      const { cookieHeader: memberCookie, userId: memberUserId } = await seedLoggedInUser(env.DB as never, {
        id: "member-1",
      });
      await seedFamily(env, "family-1", ownerId, [memberUserId]);
      await markReauthenticated(env, ownerCookie);
      await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );

      const memberCancelAttempt = await families.request(
        "/family-1/deletion/cancel",
        { method: "POST", headers: { Cookie: memberCookie } },
        env,
      );
      expect(memberCancelAttempt.status).toBe(404);

      const ownerCancel = await families.request(
        "/family-1/deletion/cancel",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );
      expect(ownerCancel.status).toBe(200);

      const memberView = await families.request("/family-1", { headers: { Cookie: memberCookie } }, env);
      expect(memberView.status).toBe(200);
    });

    it("refuses a second open family deletion request with a 409", async () => {
      const { userId: ownerId, cookieHeader: ownerCookie } = await seedLoggedInUser(env.DB as never, {
        id: "owner-1",
      });
      await seedFamily(env, "family-1", ownerId);
      await markReauthenticated(env, ownerCookie);

      await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );

      // Familien er nu skjult, så en anden anmodning skal 403'e som "ikke
      // fundet ejer" (membership-tjekket) — beviser at man ikke kan omgå
      // "kun én åben anmodning" ved bare at spamme request-ruten igen.
      const secondAttempt = await families.request(
        "/family-1/deletion/request",
        { method: "POST", headers: { Cookie: ownerCookie } },
        env,
      );
      expect(secondAttempt.status).toBe(403);
    });
  });
});
