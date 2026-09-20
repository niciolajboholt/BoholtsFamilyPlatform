import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../../testing/fakeEnv";
import { seedLoggedInUser } from "../../testing/fakeD1";

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

async function createFamilyWithChild(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
): Promise<{ familyId: string; inviteCode: string; childMemberId: string }> {
  const response = await families.request(
    "/",
    { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json" } },
    env,
  );
  const body: CreateFamilyResponse = await response.json();
  const child = body.members.find((member) => member.relation === "Barn");

  if (!child) {
    throw new Error("test setup: expected a seeded child member");
  }

  return { familyId: body.family.id, inviteCode: body.inviteCode, childMemberId: child.id };
}

describe("child messages routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  describe("POST /:id/messages", () => {
    it("lets any family member (not just owner/admin) send a message", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: created.childMemberId, body: "Hej skat, god skoledag!" }),
        },
        env,
      );
      const body = await response.json<{ message: { body: string; readAt: string | null } }>();

      expect(response.status).toBe(200);
      expect(body.message.body).toBe("Hej skat, god skoledag!");
      expect(body.message.readAt).toBeNull();
    });

    it("rejects a request from someone outside the family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const outsider = await seedLoggedInUser(env.DB as never, { id: "outsider" });

      const response = await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: outsider.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: created.childMemberId, body: "Hej" }),
        },
        env,
      );

      expect(response.status).toBe(404);
    });

    it("rejects an empty body and a body over the length limit", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const empty = await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: created.childMemberId, body: "   " }),
        },
        env,
      );
      expect(empty.status).toBe(400);

      const tooLong = await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: created.childMemberId, body: "a".repeat(281) }),
        },
        env,
      );
      expect(tooLong.status).toBe(400);
    });

    it("rejects an unknown recipient member id", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: "does-not-exist", body: "Hej" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });
  });

  describe("GET /:id/messages", () => {
    it("lets any family member read another member's messages, without marking them read", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);

      await families.request(
        `/${created.familyId}/messages`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: created.childMemberId, body: "Hej skat!" }),
        },
        env,
      );

      const response = await families.request(
        `/${created.familyId}/messages?memberId=${created.childMemberId}`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body = await response.json<{ messages: { body: string; readAt: string | null }[] }>();

      expect(response.status).toBe(200);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].readAt).toBeNull();
    });
  });

  describe("DELETE /:id/messages/:messageId", () => {
    it("lets the sender delete their own message", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const created_message = await (
        await families.request(
          `/${created.familyId}/messages`,
          {
            method: "POST",
            headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ familyMemberId: created.childMemberId, body: "Hej" }),
          },
          env,
        )
      ).json<{ message: { id: string } }>();

      const response = await families.request(
        `/${created.familyId}/messages/${created_message.message.id}`,
        { method: "DELETE", headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);
    });

    it("rejects deletion by a plain member who did not send it", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamilyWithChild(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const ownerMessage = await (
        await families.request(
          `/${created.familyId}/messages`,
          {
            method: "POST",
            headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ familyMemberId: created.childMemberId, body: "Hej" }),
          },
          env,
        )
      ).json<{ message: { id: string } }>();

      const response = await families.request(
        `/${created.familyId}/messages/${ownerMessage.message.id}`,
        { method: "DELETE", headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);
    });
  });
});
