import { Hono } from "hono";

import type { Env } from "../../env";
import { familyMemberSeeds, generateInviteCode } from "../../lib/familySeed";
import { getMembership, getMembershipForFamily } from "../../lib/familyMembership";
import { checkRateLimit } from "../../lib/rateLimit";
import { getFamily, listFamilyMembers, parseJsonBody, type Variables } from "./familyQueries";

// Sprint 24: en invitationskode har rigelig entropi til at gøre reel
// brute-force upraktisk (8 tegn fra et 33-tegns alfabet), men uden nogen
// grænse kunne en logget-ind bruger stadig hamre løs på ruten. 10 forsøg
// pr. 10 minutter er rigeligt til en legitim brugers tastefejl.
const inviteAcceptRateLimit = { maxAttempts: 10, windowMs: 10 * 60 * 1000 };

const familyCore = new Hono<{ Bindings: Env; Variables: Variables }>();

// Opret en helt ny familie. Kun mulig hvis brugeren ikke allerede er medlem
// af en (én familie pr. bruger i denne fase, jf. planens omfang) — sås med
// generiske standardnavne og en invitationskode med det samme.
familyCore.post("/", async (c) => {
  const user = c.get("user");
  const existing = await getMembership(c.env.DB, user.id);

  if (existing) {
    return c.json({ error: "Du er allerede medlem af en familie." }, 409);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim() || "Familien";
  const now = new Date().toISOString();
  const familyId = crypto.randomUUID();

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
    ).bind(familyId, name, user.id, now),
    c.env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
    ).bind(familyId, user.id, now),
  ]);

  await c.env.DB.batch(
    familyMemberSeeds.map((seed) =>
      c.env.DB.prepare(
        `INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).bind(crypto.randomUUID(), familyId, seed.name, seed.color, seed.relation, now),
    ),
  );

  const inviteCode = generateInviteCode();

  await c.env.DB.prepare(
    "INSERT INTO family_invites (code, family_id, created_by_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(inviteCode, familyId, user.id, now)
    .run();

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({
    family: {
      id: familyId,
      name,
      ownerUserId: user.id,
      createdAt: now,
      aiWeeklySummaryEnabled: 1,
    },
    role: "owner",
    members,
    inviteCode,
  });
});

// Familien den nuværende bruger er medlem af, hvis nogen.
familyCore.get("/mine", async (c) => {
  const user = c.get("user");
  const membership = await getMembership(c.env.DB, user.id);

  if (!membership) {
    return c.json({ family: null });
  }

  const family = await getFamily(c.env.DB, membership.familyId);

  if (!family) {
    return c.json({ family: null });
  }

  const members = await listFamilyMembers(c.env.DB, family.id);

  const activeInvite = await c.env.DB.prepare(
    "SELECT code FROM family_invites WHERE family_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
  )
    .bind(family.id)
    .first<{ code: string }>();

  return c.json({
    family,
    role: membership.role,
    members,
    inviteCode: activeInvite?.code ?? null,
  });
});

// Tilslut den nuværende bruger til en familie via invitationskode. Én
// familie pr. bruger i denne fase — allerede-medlemmer må forlade først
// (ikke bygget endnu, ligesom flere-familier-support).
familyCore.post("/invites/:code/accept", async (c) => {
  const user = c.get("user");
  const code = c.req.param("code").trim().toUpperCase();

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "invite-accept",
    key: user.id,
    ...inviteAcceptRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  const existing = await getMembership(c.env.DB, user.id);

  if (existing) {
    return c.json({ error: "Du er allerede medlem af en familie." }, 409);
  }

  const invite = await c.env.DB.prepare(
    "SELECT code, family_id AS familyId FROM family_invites WHERE code = ? AND revoked_at IS NULL",
  )
    .bind(code)
    .first<{ code: string; familyId: string }>();

  if (!invite) {
    return c.json({ error: "Ugyldig eller udløbet invitationskode." }, 404);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
  )
    .bind(invite.familyId, user.id, now)
    .run();

  const family = await getFamily(c.env.DB, invite.familyId);
  const members = await listFamilyMembers(c.env.DB, invite.familyId);

  return c.json({ family, role: "member", members });
});

// Kun ejer/admin må regenerere invitationskoden — den gamle spærres
// (revoked_at), i stedet for slettes, så vi bevarer historik.
familyCore.post("/:id/invites/regenerate", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan regenerere invitationskoden." }, 403);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE family_invites SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
  )
    .bind(now, familyId)
    .run();

  const newCode = generateInviteCode();

  await c.env.DB.prepare(
    "INSERT INTO family_invites (code, family_id, created_by_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(newCode, familyId, user.id, now)
    .run();

  return c.json({ inviteCode: newCode });
});

// Omdøb familien — ejer/admin.
familyCore.patch("/:id", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan omdøbe familien." }, 403);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Navn må ikke være tomt." }, 400);
  }

  await c.env.DB.prepare("UPDATE families SET name = ? WHERE id = ?").bind(name, familyId).run();

  const family = await getFamily(c.env.DB, familyId);

  return c.json({ family });
});

familyCore.get("/:id", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const family = await getFamily(c.env.DB, familyId);
  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ family, role: membership.role, members });
});

export default familyCore;
