import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";
import families from "./families";

interface FamilyMemberJson {
  id: string;
  name: string;
  color: string;
  relation: string | null;
  isPlaceholderName: number;
  linkedUserId: string | null;
}

interface CreateFamilyResponse {
  family: { id: string; name: string; ownerUserId: string; aiWeeklySummaryEnabled: number };
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

    it("rejects further attempts after too many invalid codes (rate-limit)", async () => {
      const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "someone" });

      let lastResponse: Response | undefined;
      for (let i = 0; i < 11; i++) {
        lastResponse = await families.request(
          "/invites/NOTREAL1/accept",
          { method: "POST", headers: { Cookie: cookieHeader } },
          env,
        );
      }

      expect(lastResponse?.status).toBe(429);
    });

    it("does not rate-limit a different user's attempts", async () => {
      const { cookieHeader: hammered } = await seedLoggedInUser(env.DB as never, {
        id: "attacker",
      });
      for (let i = 0; i < 10; i++) {
        await families.request(
          "/invites/NOTREAL1/accept",
          { method: "POST", headers: { Cookie: hammered } },
          env,
        );
      }

      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");
      const { cookieHeader: freshUser } = await seedLoggedInUser(env.DB as never, {
        id: "christine",
      });

      const response = await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: freshUser } },
        env,
      );

      expect(response.status).toBe(200);
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

  describe("share-link", () => {
    it("GET returns null when no link has been created", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/share-link`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(await response.json()).toEqual({ shareLink: null });
    });

    it("POST rejects a plain member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [created.members[0].id] }),
        },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("POST rejects an empty member selection", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [] }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("POST rejects a member id that does not belong to the family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: ["not-a-real-member"] }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("POST creates a link, GET then returns it, and regenerating issues a different token", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const [firstMember, secondMember] = created.members;

      const createResponse = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [firstMember.id, secondMember.id] }),
        },
        env,
      );
      const createBody: { shareLink: { token: string; includedMemberIds: string[] } } =
        await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect([...createBody.shareLink.includedMemberIds].sort()).toEqual(
        [firstMember.id, secondMember.id].sort(),
      );

      const getResponse = await families.request(
        `/${created.family.id}/share-link`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(await getResponse.json()).toEqual(createBody);

      const regenerateResponse = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [firstMember.id] }),
        },
        env,
      );
      const regenerateBody: { shareLink: { token: string } } = await regenerateResponse.json();

      expect(regenerateBody.shareLink.token).not.toBe(createBody.shareLink.token);
    });

    it("POST defaults includeDescription/includeLocation to false when omitted", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [created.members[0].id] }),
        },
        env,
      );
      const body: { shareLink: { includeDescription: boolean; includeLocation: boolean } } =
        await response.json();

      expect(body.shareLink.includeDescription).toBe(false);
      expect(body.shareLink.includeLocation).toBe(false);
    });

    it("POST stores includeDescription/includeLocation when explicitly requested", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            memberIds: [created.members[0].id],
            includeDescription: true,
            includeLocation: true,
          }),
        },
        env,
      );
      const body: { shareLink: { includeDescription: boolean; includeLocation: boolean } } =
        await response.json();

      expect(body.shareLink.includeDescription).toBe(true);
      expect(body.shareLink.includeLocation).toBe(true);

      const getResponse = await families.request(
        `/${created.family.id}/share-link`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const getBody: { shareLink: { includeDescription: boolean; includeLocation: boolean } } =
        await getResponse.json();

      expect(getBody.shareLink.includeDescription).toBe(true);
      expect(getBody.shareLink.includeLocation).toBe(true);
    });

    it("DELETE deactivates the link so GET no longer returns it", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      await families.request(
        `/${created.family.id}/share-link`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: [created.members[0].id] }),
        },
        env,
      );

      const deleteResponse = await families.request(
        `/${created.family.id}/share-link`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(deleteResponse.status).toBe(200);

      const getResponse = await families.request(
        `/${created.family.id}/share-link`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect(await getResponse.json()).toEqual({ shareLink: null });
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

  describe("POST /:id/members/:memberId/link-me", () => {
    it("links the acting user to a member as their own profile", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = created.members.find((m) => m.relation !== null)!;

      const response = await families.request(
        `/${created.family.id}/members/${member.id}/link-me`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body: { members: FamilyMemberJson[] } = await response.json();

      expect(response.status).toBe(200);
      expect(body.members.find((m) => m.id === member.id)?.linkedUserId).toBe("owner");
    });

    it("moves the link when the user picks a different member afterwards", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const [firstMember, secondMember] = created.members.filter((m) => m.relation !== null);

      await families.request(
        `/${created.family.id}/members/${firstMember.id}/link-me`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.family.id}/members/${secondMember.id}/link-me`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body: { members: FamilyMemberJson[] } = await response.json();

      expect(body.members.find((m) => m.id === firstMember.id)?.linkedUserId).toBeNull();
      expect(body.members.find((m) => m.id === secondMember.id)?.linkedUserId).toBe("owner");
    });

    it("rejects linking the reserved 'Familien' pseudo-member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const familyPseudoMember = created.members.find((m) => m.relation === null)!;

      const response = await families.request(
        `/${created.family.id}/members/${familyPseudoMember.id}/link-me`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("rejects linking a member already linked to a different user", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = created.members.find((m) => m.relation !== null)!;

      await families.request(
        `/${created.family.id}/members/${member.id}/link-me`,
        { method: "POST", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      const otherUser = await seedLoggedInUser(env.DB as never, { id: "other" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: otherUser.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.family.id}/members/${member.id}/link-me`,
        { method: "POST", headers: { Cookie: otherUser.cookieHeader } },
        env,
      );

      expect(response.status).toBe(409);
    });
  });

  describe("GET /:id/weekly-summary", () => {
    it("returns null when no summary has been generated yet", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/weekly-summary`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body: { summary: { weekStart: string; content: string } | null } = await response.json();

      expect(response.status).toBe(200);
      expect(body.summary).toBeNull();
    });

    it("returns the newest saved summary", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      await env.DB.prepare(
        "INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind("summary-old", created.family.id, "2026-08-10", "Gammelt resumé.", new Date().toISOString())
        .run();
      await env.DB.prepare(
        "INSERT INTO family_weekly_summaries (id, family_id, week_start, content, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind("summary-new", created.family.id, "2026-08-17", "Nyt resumé.", new Date().toISOString())
        .run();

      const response = await families.request(
        `/${created.family.id}/weekly-summary`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      const body: { summary: { weekStart: string; content: string } | null } = await response.json();

      expect(body.summary?.content).toBe("Nyt resumé.");
      expect(body.summary?.weekStart).toBe("2026-08-17");
    });

    it("rejects a user who is not a member of the family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const outsider = await seedLoggedInUser(env.DB as never, { id: "outsider" });

      const response = await families.request(
        `/${created.family.id}/weekly-summary`,
        { headers: { Cookie: outsider.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);
    });
  });

  describe("PATCH /:id/privacy-settings", () => {
    it("lets the owner disable the AI weekly summary", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/privacy-settings`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ aiWeeklySummaryEnabled: false }),
        },
        env,
      );
      const family = await env.DB.prepare(
        "SELECT ai_weekly_summary_enabled AS enabled FROM families WHERE id = ?",
      ).bind(created.family.id).first<{ enabled: number }>();

      expect(response.status).toBe(200);
      expect(family?.enabled).toBe(0);
    });

    it("rejects invalid values and non-members", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const outsider = await seedLoggedInUser(env.DB as never, { id: "outsider" });
      const created = await createFamily(env, owner.cookieHeader);

      const invalid = await families.request(
        `/${created.family.id}/privacy-settings`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ aiWeeklySummaryEnabled: "yes" }),
        },
        env,
      );
      const forbidden = await families.request(
        `/${created.family.id}/privacy-settings`,
        {
          method: "PATCH",
          headers: { Cookie: outsider.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ aiWeeklySummaryEnabled: false }),
        },
        env,
      );

      expect(invalid.status).toBe(400);
      expect(forbidden.status).toBe(403);
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

  describe("PATCH /:id", () => {
    it("rejects a rename from a user who belongs to a different family entirely", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");

      const outsiderOwner = await seedLoggedInUser(env.DB as never, { id: "outsider-owner" });
      await createFamily(env, outsiderOwner.cookieHeader, "Naboerne");

      const response = await families.request(
        `/${created.family.id}`,
        {
          method: "PATCH",
          headers: { Cookie: outsiderOwner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Kapret navn" }),
        },
        env,
      );

      expect(response.status).toBe(403);

      const unchanged = await families.request(
        `/${created.family.id}`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await unchanged.json()).family.name).toBe("Boholt");
    });
  });

  describe("POST /:id/invites/regenerate", () => {
    it("rejects a regenerate request from a user who belongs to a different family entirely", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");
      const originalCode = created.inviteCode;

      const outsiderOwner = await seedLoggedInUser(env.DB as never, { id: "outsider-owner" });
      await createFamily(env, outsiderOwner.cookieHeader, "Naboerne");

      const response = await families.request(
        `/${created.family.id}/invites/regenerate`,
        { method: "POST", headers: { Cookie: outsiderOwner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(403);

      const mine = await families.request(
        "/mine",
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await mine.json()).inviteCode).toBe(originalCode);
    });
  });

  describe("ICS-abonnementer (Fase 9)", () => {
    it("returns an empty list for a new family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(response.status).toBe(200);
      expect((await response.json()).subscriptions).toEqual([]);
    });

    it("lets the owner create a subscription and assign it to a member", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const memberId = created.members[0]!.id;

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://calendar.example.com/skole.ics",
            label: "Skolekalender",
            familyMemberId: memberId,
          }),
        },
        env,
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.subscriptions).toHaveLength(1);
      expect(body.subscriptions[0]).toMatchObject({
        url: "https://calendar.example.com/skole.ics",
        label: "Skolekalender",
        familyMemberId: memberId,
      });
    });

    it("rejects a plain member trying to create a subscription", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: member.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics", label: "X" }),
        },
        env,
      );

      expect(response.status).toBe(403);
    });

    it("rejects a non-http(s) URL", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "file:///etc/passwd", label: "X" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("rejects a missing label", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics" }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("rejects a familyMemberId that belongs to a different family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");

      const otherOwner = await seedLoggedInUser(env.DB as never, { id: "other-owner" });
      const otherFamily = await createFamily(env, otherOwner.cookieHeader, "Naboerne");
      const foreignMemberId = otherFamily.members[0]!.id;

      const response = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://calendar.example.com/x.ics",
            label: "X",
            familyMemberId: foreignMemberId,
          }),
        },
        env,
      );

      expect(response.status).toBe(400);
    });

    it("enforces the 5-subscription cap per family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);

      for (let i = 0; i < 5; i++) {
        const response = await families.request(
          `/${created.family.id}/ics-subscriptions`,
          {
            method: "POST",
            headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ url: `https://calendar.example.com/${i}.ics`, label: `Kalender ${i}` }),
          },
          env,
        );
        expect(response.status).toBe(200);
      }

      const sixth = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/6.ics", label: "Kalender 6" }),
        },
        env,
      );

      expect(sixth.status).toBe(409);
    });

    it("lets the owner update a subscription's label and member assignment", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const memberId = created.members[0]!.id;

      const createResponse = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics", label: "Oprindeligt navn" }),
        },
        env,
      );
      const subscriptionId = (await createResponse.json()).subscriptions[0].id;

      const updateResponse = await families.request(
        `/${created.family.id}/ics-subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Nyt navn", familyMemberId: memberId }),
        },
        env,
      );

      expect(updateResponse.status).toBe(200);
      const updated = (await updateResponse.json()).subscriptions[0];
      expect(updated.label).toBe("Nyt navn");
      expect(updated.familyMemberId).toBe(memberId);
    });

    it("returns 404 when updating a subscription that belongs to a different family", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader, "Boholt");
      const createResponse = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics", label: "X" }),
        },
        env,
      );
      const subscriptionId = (await createResponse.json()).subscriptions[0].id;

      const otherOwner = await seedLoggedInUser(env.DB as never, { id: "other-owner" });
      const otherFamily = await createFamily(env, otherOwner.cookieHeader, "Naboerne");

      const response = await families.request(
        `/${otherFamily.family.id}/ics-subscriptions/${subscriptionId}`,
        {
          method: "PATCH",
          headers: { Cookie: otherOwner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Kapret" }),
        },
        env,
      );

      expect(response.status).toBe(404);
    });

    it("lets the owner delete a subscription", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const createResponse = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics", label: "X" }),
        },
        env,
      );
      const subscriptionId = (await createResponse.json()).subscriptions[0].id;

      const deleteResponse = await families.request(
        `/${created.family.id}/ics-subscriptions/${subscriptionId}`,
        { method: "DELETE", headers: { Cookie: owner.cookieHeader } },
        env,
      );

      expect(deleteResponse.status).toBe(200);
      expect((await deleteResponse.json()).subscriptions).toEqual([]);
    });

    it("does not let a plain member delete a subscription", async () => {
      const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
      const created = await createFamily(env, owner.cookieHeader);
      const createResponse = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        {
          method: "POST",
          headers: { Cookie: owner.cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://calendar.example.com/x.ics", label: "X" }),
        },
        env,
      );
      const subscriptionId = (await createResponse.json()).subscriptions[0].id;

      const member = await seedLoggedInUser(env.DB as never, { id: "member" });
      await families.request(
        `/invites/${created.inviteCode}/accept`,
        { method: "POST", headers: { Cookie: member.cookieHeader } },
        env,
      );

      const deleteResponse = await families.request(
        `/${created.family.id}/ics-subscriptions/${subscriptionId}`,
        { method: "DELETE", headers: { Cookie: member.cookieHeader } },
        env,
      );

      expect(deleteResponse.status).toBe(403);

      const stillThere = await families.request(
        `/${created.family.id}/ics-subscriptions`,
        { headers: { Cookie: owner.cookieHeader } },
        env,
      );
      expect((await stillThere.json()).subscriptions).toHaveLength(1);
    });

    describe("GET /:id/ics-subscriptions/:subscriptionId/events", () => {
      const fetchMock = vi.fn();

      beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      async function createSubscription(
        cookieHeader: string,
        familyId: string,
        url = "https://calendar.example.com/x.ics",
      ): Promise<string> {
        const response = await families.request(
          `/${familyId}/ics-subscriptions`,
          {
            method: "POST",
            headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ url, label: "X" }),
          },
          env,
        );
        return (await response.json()).subscriptions[0].id;
      }

      it("fetches, parses, and returns the subscription's events", async () => {
        const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
        const created = await createFamily(env, owner.cookieHeader);
        const subscriptionId = await createSubscription(owner.cookieHeader, created.family.id);

        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "BEGIN:VEVENT",
          "UID:evt@example.com",
          "DTSTAMP:20260101T000000Z",
          "DTSTART:20260901T090000Z",
          "DTEND:20260901T100000Z",
          "SUMMARY:Bowling",
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");
        fetchMock.mockResolvedValue(new Response(ics, { status: 200 }));

        const response = await families.request(
          `/${created.family.id}/ics-subscriptions/${subscriptionId}/events?start=2026-08-01T00:00:00.000Z&end=2026-10-01T00:00:00.000Z`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.events).toHaveLength(1);
        expect(body.events[0]).toMatchObject({ title: "Bowling" });

        const subscriptions = await families.request(
          `/${created.family.id}/ics-subscriptions`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        );
        const subscriptionRow = (await subscriptions.json()).subscriptions[0];
        expect(subscriptionRow.lastFetchStatus).toBe("ok");
        expect(subscriptionRow.lastFetchedAt).toEqual(expect.any(String));
      });

      it("returns a readable error and records the failure status when the feed can't be fetched", async () => {
        const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
        const created = await createFamily(env, owner.cookieHeader);
        const subscriptionId = await createSubscription(owner.cookieHeader, created.family.id);

        fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

        const response = await families.request(
          `/${created.family.id}/ics-subscriptions/${subscriptionId}/events`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        );

        expect(response.status).toBe(502);

        const subscriptions = await families.request(
          `/${created.family.id}/ics-subscriptions`,
          { headers: { Cookie: owner.cookieHeader } },
          env,
        );
        expect((await subscriptions.json()).subscriptions[0].lastFetchStatus).toBe("network");
      });

      it("returns 404 for a subscription belonging to a different family", async () => {
        const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
        const created = await createFamily(env, owner.cookieHeader, "Boholt");
        const subscriptionId = await createSubscription(owner.cookieHeader, created.family.id);

        const otherOwner = await seedLoggedInUser(env.DB as never, { id: "other-owner" });
        const otherFamily = await createFamily(env, otherOwner.cookieHeader, "Naboerne");

        const response = await families.request(
          `/${otherFamily.family.id}/ics-subscriptions/${subscriptionId}/events`,
          { headers: { Cookie: otherOwner.cookieHeader } },
          env,
        );

        expect(response.status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });
  });
});
