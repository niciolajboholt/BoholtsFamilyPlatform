import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";
import families from "./families";

interface FamilyMemberJson {
  id: string;
  name: string;
  color: string;
  relation: string | null;
  isPlaceholderName: number;
}

interface CreateFamilyResponse {
  family: { id: string; name: string; ownerUserId: string };
  role: string;
  members: FamilyMemberJson[];
  inviteCode: string;
}

async function createFamily(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
  name?: string,
): Promise<CreateFamilyResponse> {
  const response = await families.request(
    "/",
    {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify(name ? { name } : {}),
    },
    env,
  );
  return response.json();
}

describe("families routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  it("rejects any request without a session cookie", async () => {
    const response = await families.request("/mine", {}, env);
    expect(response.status).toBe(401);
  });

  describe("POST / (create family)", () => {
    it("creates a family, seeds the generic members, and returns an invite code", async () => {
      const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "owner" });

      const response = await families.request(
        "/",
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Boholt" }),
        },
        env,
      );
      const body: CreateFamilyResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.family.name).toBe("Boholt");
      expect(body.family.ownerUserId).toBe(userId);
      expect(body.role).toBe("owner");
      // Medlemmer sås med crypto.randomUUID() som id, ikke seedets faste
      // slugs (far/mor/barn-1/barn-2/family) — de er kun navn/farve/relation
      // her; se relation IS NULL-testen nedenfor for hvordan
      // familie-pseudomedlemmet reelt kendes igen.
      expect(body.members.map((m) => m.name).sort()).toEqual(
        ["Barn 1", "Barn 2", "Familien", "Far", "Mor"].sort(),
      );
      expect(body.members.every((m) => m.id.length > 0)).toBe(true);
      expect(new Set(body.members.map((m) => m.id)).size).toBe(5);
      expect(body.inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    });

    it("defaults the name to 'Familien' when none is given", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const body = await createFamily(env, cookieHeader);
      expect(body.family.name).toBe("Familien");
    });

    it("rejects a second family for a user who is already a member", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "owner" });
      await createFamily(env, cookieHeader);

      const response = await families.request(
        "/",
        { method: "POST", headers: { Cookie: cookieHeader } },
        env,
      );

      expect(response.status).toBe(409);
    });
  });

  describe("GET /mine", () => {
    it("returns null when the user has no family yet", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const response = await families.request("/mine", { headers: { Cookie: cookieHeader } }, env);
      expect(await response.json()).toEqual({ family: null });
    });

    it("returns the family, role and active invite code", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, cookieHeader, "Boholt");

      const response = await families.request("/mine", { headers: { Cookie: cookieHeader } }, env);
      const body: CreateFamilyResponse = await response.json();

      expect(body.family.id).toBe(created.family.id);
      expect(body.role).toBe("owner");
      expect(body.inviteCode).toBe(created.inviteCode);
    });
  });

  describe("POST /invites/:code/accept", () => {
    it("joins the family as a member with a valid code", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");

      const christine = await seedLoggedInUser(env.DB as never, { id: "christine" });
      const response = await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: christine.cookieHeader } },
        env,
      );
      const body: CreateFamilyResponse = await response.json();

      expect(response.status).toBe(200);
      expect(body.role).toBe("member");
      expect(body.family.id).toBe(created.family.id);
    });

    it("rejects joining when already a member of a family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");

      const response = await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(409);
    });

    it("rejects an invalid invite code", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "someone" });

      const response = await families.request(
        "/invites/NOTREAL1/accept",
        { method: "POST", headers: { Cookie: cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });
  });

  describe("POST /:id/invites/regenerate", () => {
    it("rejects a plain member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.family.id}/invites/regenerate`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("revokes the old code and issues a new one that still works", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/invites/regenerate`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const { inviteCode: newCode } = await response.json();

      expect(newCode).not.toBe(created.inviteCode);

      const oldCodeAttempt = await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: (await seedLoggedInUser(env.DB as never, { id: "late" })).cookieHeader } },
        env,
      );
      expect(oldCodeAttempt.status).toBe(404);

      const newCodeAttempt = await families.request(
        `/invites/${newCode}/accept`,
        { method: "POST", headers: { Cookie: (await seedLoggedInUser(env.DB as never, { id: "ontime" })).cookieHeader } },
        env,
      );
      expect(newCodeAttempt.status).toBe(200);
    });
  });

  describe("PATCH /:id (rename)", () => {
    it("rejects a non-admin", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const outsider = await seedLoggedInUser(env.DB as never, { id: "outsider" });

      const response = await families.request(
        `/${created.family.id}`,
        {
          method: "PATCH",
          headers: { Cookie: outsider.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hacket" }),
        },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("rejects an empty name", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "   " }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("renames the family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Boholts" }),
        },
        env,
      );
      const body = await response.json();

      expect(body.family.name).toBe("Boholts");
    });
  });

  describe("family members", () => {
    it("rejects adding a member without a name or color", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/members`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Onkel Bo" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("adds, edits, and deletes a member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const addResponse = await families.request(
        `/${created.family.id}/members`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Onkel Bo", color: "#123456", relation: "Andet" }),
        },
        env,
      );
      const afterAdd: { members: FamilyMemberJson[] } = await addResponse.json();
      const newMember = afterAdd.members.find((m) => m.name === "Onkel Bo");
      expect(newMember).toBeDefined();
      expect(newMember?.isPlaceholderName).toBe(0);

      const editResponse = await families.request(
        `/${created.family.id}/members/${newMember!.id}`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ color: "#abcdef" }),
        },
        env,
      );
      const afterEdit: { members: FamilyMemberJson[] } = await editResponse.json();
      expect(afterEdit.members.find((m) => m.id === newMember!.id)?.color).toBe("#abcdef");

      const deleteResponse = await families.request(
        `/${created.family.id}/members/${newMember!.id}`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const afterDelete: { members: FamilyMemberJson[] } = await deleteResponse.json();
      expect(afterDelete.members.some((m) => m.id === newMember!.id)).toBe(false);
    });

    it("never deletes the reserved 'Familien' pseudo-member, even by its real id", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      // Pseudomedlemmet er ikke identificerbart via id="family" (det er en
      // tilfældig UUID ligesom alle andre såede medlemmer) — den eneste
      // pålidelige markør er relation === null (samme konvention som resten
      // af families.ts bruger).
      const familyPseudoMember = created.members.find((m) => m.relation === null);
      expect(familyPseudoMember).toBeDefined();

      const response = await families.request(
        `/${created.family.id}/members/${familyPseudoMember!.id}`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body: { members: FamilyMemberJson[] } = await response.json();

      expect(body.members.some((m) => m.id === familyPseudoMember!.id)).toBe(true);
    });
  });

  describe("role and ownership management", () => {
    async function createFamilyWithMember(): Promise<{
      familyId: string;
      owner: { userId: string; cookieHeader: string };
      member: { userId: string; cookieHeader: string };
    }> {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );
      return { familyId: created.family.id, owner, member };
    }

    it("only lets the owner change roles", async () => {
      const { familyId, member } = await createFamilyWithMember();

      const response = await families.request(
        `/${familyId}/memberships/${member.userId}/role`,
        {
          method: "POST",
          headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("promotes a member to admin", async () => {
      const { familyId, owner, member } = await createFamilyWithMember();

      const response = await families.request(
        `/${familyId}/memberships/${member.userId}/role`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        },
        env,
      );

      expect(response.status).toBe(200);

      const asMember = await families.request(`/${familyId}`, { headers: { Cookie: member.cookieHeader } }, env);
      expect((await asMember.json()).role).toBe("admin");
    });

    it("rejects changing the owner's own role via the role endpoint", async () => {
      const { familyId, owner } = await createFamilyWithMember();

      const response = await families.request(
        `/${familyId}/memberships/${owner.userId}/role`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("transfers ownership, demoting the previous owner to admin", async () => {
      const { familyId, owner, member } = await createFamilyWithMember();

      const response = await families.request(
        `/${familyId}/transfer-ownership`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerUserId: member.userId }),
        },
        env,
      );
      expect(response.status).toBe(200);

      const familyAsNewOwner = await families.request(`/${familyId}`, { headers: { Cookie: member.cookieHeader } }, env);
      const newOwnerBody = await familyAsNewOwner.json();
      expect(newOwnerBody.role).toBe("owner");
      expect(newOwnerBody.family.ownerUserId).toBe(member.userId);

      const familyAsOldOwner = await families.request(`/${familyId}`, { headers: { Cookie: owner.cookieHeader } }, env);
      expect((await familyAsOldOwner.json()).role).toBe("admin");
    });

    it("refuses to transfer ownership to a non-member", async () => {
      const { familyId, owner } = await createFamilyWithMember();

      const response = await families.request(
        `/${familyId}/transfer-ownership`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerUserId: "not-a-member" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("removes a member's access but refuses to remove the owner", async () => {
      const { familyId, owner, member } = await createFamilyWithMember();

      const removeOwnerAttempt = await families.request(
        `/${familyId}/memberships/${owner.userId}`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(removeOwnerAttempt.status).toBe(400);

      const removeMember = await families.request(
        `/${familyId}/memberships/${member.userId}`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(removeMember.status).toBe(200);

      const asRemovedMember = await families.request(`/${familyId}`, { headers: { Cookie: member.cookieHeader } }, env);
      expect(asRemovedMember.status).toBe(404);
    });
  });

  describe("calendar member mappings (Fase 4)", () => {
    it("lets any member list the mappings, but only owner/admin write them", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );
      const targetMemberId = created.members[0].id;

      const readAsMember = await families.request(
        `/${created.family.id}/calendar-mappings`,
        { headers: { Cookie: member.cookieHeader } },
        env,
      );
      expect(readAsMember.status).toBe(200);

      const writeAsMember = await families.request(
        `/${created.family.id}/calendar-mappings/primary%40example.com`,
        {
          method: "PUT",
          headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: targetMemberId }),
        },
        env,
      );
      expect(writeAsMember.status).toBe(403);
    });

    it("rejects a familyMemberId that belongs to a different family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");

      const otherOwner = await seedLoggedInUser(env.DB as never, { id: "other-owner" });
      const otherFamily = await createFamily(env, otherOwner.cookieHeader, "Naboerne");
      const foreignMemberId = otherFamily.members[0].id;

      const response = await families.request(
        `/${created.family.id}/calendar-mappings/primary%40example.com`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: foreignMemberId }),
        },
        env,
      );

      expect(response.status).toBe(400);

      const mappings = await families.request(
        `/${created.family.id}/calendar-mappings`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await mappings.json()).mappings).toEqual([]);
    });

    it("sets, updates, deletes a single mapping, and clears all mappings", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const [firstMember, secondMember] = created.members;

      const setResponse = await families.request(
        `/${created.family.id}/calendar-mappings/primary%40example.com`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: firstMember.id }),
        },
        env,
      );
      expect((await setResponse.json()).mappings).toEqual([
        { googleCalendarId: "primary@example.com", familyMemberId: firstMember.id },
      ]);

      const updateResponse = await families.request(
        `/${created.family.id}/calendar-mappings/primary%40example.com`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: secondMember.id }),
        },
        env,
      );
      expect((await updateResponse.json()).mappings).toEqual([
        { googleCalendarId: "primary@example.com", familyMemberId: secondMember.id },
      ]);

      const deleteResponse = await families.request(
        `/${created.family.id}/calendar-mappings/primary%40example.com`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await deleteResponse.json()).mappings).toEqual([]);

      await families.request(
        `/${created.family.id}/calendar-mappings/work%40example.com`,
        {
          method: "PUT",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ familyMemberId: firstMember.id }),
        },
        env,
      );

      const clearAllResponse = await families.request(
        `/${created.family.id}/calendar-mappings`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await clearAllResponse.json()).mappings).toEqual([]);
    });
  });

  describe("GET /:id", () => {
    it("returns 404 for a family the user isn't a member of", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const outsider = await seedLoggedInUser(env.DB as never, { id: "outsider" });

      const response = await families.request(
        `/${created.family.id}`,
        { headers: { Cookie: outsider.cookieHeader } },
        env,
      );

      expect(response.status).toBe(404);
    });
  });
});
