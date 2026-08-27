import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { familyMemberSeeds, generateInviteCode, generateShareToken } from "../lib/familySeed";
import { getMembership, getMembershipForFamily } from "../lib/familyMembership";
import { checkRateLimit } from "../lib/rateLimit";
import { getSessionUser, type SessionUser } from "../lib/session";
import { logError } from "../lib/structuredLog";

// Sprint 24: en invitationskode har rigelig entropi til at gøre reel
// brute-force upraktisk (8 tegn fra et 33-tegns alfabet), men uden nogen
// grænse kunne en logget-ind bruger stadig hamre løs på ruten. 10 forsøg
// pr. 10 minutter er rigeligt til en legitim brugers tastefejl.
const inviteAcceptRateLimit = { maxAttempts: 10, windowMs: 10 * 60 * 1000 };

type Variables = { user: SessionUser };
const families = new Hono<{ Bindings: Env; Variables: Variables }>();

// Requests med tomt/ugyldigt JSON-body behandles som "ingen felter angivet"
// i stedet for en fejl — hvert kaldested validerer selv de felter, det har
// brug for.
async function parseJsonBody<T extends object>(
  c: Context,
): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

// Uden dette viser Cloudflares logs kun et stack-trace uden selve
// fejlbeskeden for uventede (ufangede) fejl, fx D1-fejl — samme problem vi
// stødte på i auth.ts's callback, før den fik sin egen try/catch.
families.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Familie-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

// Enhver /api/families*-rute kræver en gyldig session — der er ingen
// offentlige familie-data.
families.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

interface FamilyRow {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  aiWeeklySummaryEnabled: number;
}

async function getFamily(db: D1Database, familyId: string): Promise<FamilyRow | null> {
  const row = await db
    .prepare(
      `SELECT id, name, owner_user_id AS ownerUserId, created_at AS createdAt,
              ai_weekly_summary_enabled AS aiWeeklySummaryEnabled
       FROM families WHERE id = ?`,
    )
    .bind(familyId)
    .first<FamilyRow>();

  return row ?? null;
}

interface FamilyMemberRow {
  id: string;
  name: string;
  color: string;
  relation: string | null;
  isPlaceholderName: number;
  linkedUserId: string | null;
}

async function listFamilyMembers(
  db: D1Database,
  familyId: string,
): Promise<FamilyMemberRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, color, relation, is_placeholder_name AS isPlaceholderName, linked_user_id AS linkedUserId
       FROM family_members WHERE family_id = ? ORDER BY created_at ASC`,
    )
    .bind(familyId)
    .all<FamilyMemberRow>();

  return result.results;
}

// Opret en helt ny familie. Kun mulig hvis brugeren ikke allerede er medlem
// af en (én familie pr. bruger i denne fase, jf. planens omfang) — sås med
// generiske standardnavne og en invitationskode med det samme.
families.post("/", async (c) => {
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
families.get("/mine", async (c) => {
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
families.post("/invites/:code/accept", async (c) => {
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
families.post("/:id/invites/regenerate", async (c) => {
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

interface ShareLinkRow {
  token: string;
  includedMemberIds: string;
  includeDescription: number;
  includeLocation: number;
}

function parseIncludedMemberIds(csv: string): string[] {
  return csv.split(",").filter((id) => id.length > 0);
}

// Familiens aktive delelink, hvis nogen — bruges af Indstillinger til at
// vise den aktuelle status uden at skulle regenerere for at se den.
families.get("/:id/share-link", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke medlem af denne familie." }, 403);
  }

  const row = await c.env.DB.prepare(
    `SELECT token, included_member_ids AS includedMemberIds,
            include_description AS includeDescription, include_location AS includeLocation
     FROM family_share_links WHERE family_id = ? AND revoked_at IS NULL`,
  )
    .bind(familyId)
    .first<ShareLinkRow>();

  if (!row) {
    return c.json({ shareLink: null });
  }

  return c.json({
    shareLink: {
      token: row.token,
      includedMemberIds: parseIncludedMemberIds(row.includedMemberIds),
      includeDescription: Boolean(row.includeDescription),
      includeLocation: Boolean(row.includeLocation),
    },
  });
});

// Opret/regenerér delelinket med et valgt sæt familiemedlemmer — kun
// ejer/admin, ligesom invitations-regenerering. Et gammelt link spærres
// (revoked_at) i stedet for slettes, samme mønster som family_invites.
families.post("/:id/share-link", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan oprette en delelink." }, 403);
  }

  const body = await parseJsonBody<{
    memberIds: string[];
    includeDescription?: boolean;
    includeLocation?: boolean;
  }>(c);
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.filter((id) => typeof id === "string" && id.length > 0))]
    : [];
  const includeDescription = body.includeDescription === true;
  const includeLocation = body.includeLocation === true;

  if (memberIds.length === 0) {
    return c.json({ error: "Vælg mindst ét familiemedlem." }, 400);
  }

  const existingMembers = await c.env.DB.prepare(
    "SELECT id FROM family_members WHERE family_id = ?",
  )
    .bind(familyId)
    .all<{ id: string }>();
  const validMemberIds = new Set(existingMembers.results.map((row) => row.id));

  if (!memberIds.every((id) => validMemberIds.has(id))) {
    return c.json({ error: "Et eller flere familiemedlemmer findes ikke." }, 400);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE family_share_links SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
  )
    .bind(now, familyId)
    .run();

  const token = generateShareToken();

  await c.env.DB.prepare(
    `INSERT INTO family_share_links
       (id, family_id, token, created_by_user_id, included_member_ids, include_description, include_location, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      familyId,
      token,
      user.id,
      memberIds.join(","),
      includeDescription ? 1 : 0,
      includeLocation ? 1 : 0,
      now,
    )
    .run();

  return c.json({
    shareLink: { token, includedMemberIds: memberIds, includeDescription, includeLocation },
  });
});

// Deaktivér delelinket — kun ejer/admin.
families.delete("/:id/share-link", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan deaktivere delelinket." }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE family_share_links SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
  )
    .bind(new Date().toISOString(), familyId)
    .run();

  return c.json({ ok: true });
});

// Nyeste gemte AI-ugeresumé (Sprint 28) — genereret ugentligt af
// server/lib/weeklySummary.ts's Cron Trigger, ikke on-demand her.
families.get("/:id/weekly-summary", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke medlem af denne familie." }, 403);
  }

  const summary = await c.env.DB.prepare(
    `SELECT week_start AS weekStart, content, created_at AS createdAt
     FROM family_weekly_summaries WHERE family_id = ? ORDER BY week_start DESC LIMIT 1`,
  )
    .bind(familyId)
    .first<{ weekStart: string; content: string; createdAt: string }>();

  return c.json({ summary: summary ?? null });
});

// Privatlivsvalg for automatisk AI-behandling — ejer/admin, da indstillingen
// gælder hele familiens kalender-, opgave- og indkøbsdata.
families.patch("/:id/privacy-settings", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre familiens privatlivsvalg." }, 403);
  }

  const body = await parseJsonBody<{ aiWeeklySummaryEnabled: boolean }>(c);
  if (typeof body.aiWeeklySummaryEnabled !== "boolean") {
    return c.json({ error: "AI-indstillingen skal være sand eller falsk." }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE families SET ai_weekly_summary_enabled = ? WHERE id = ?",
  )
    .bind(body.aiWeeklySummaryEnabled ? 1 : 0, familyId)
    .run();

  return c.json({ aiWeeklySummaryEnabled: body.aiWeeklySummaryEnabled });
});

// Omdøb familien — ejer/admin.
families.patch("/:id", async (c) => {
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

  await c.env.DB.prepare("UPDATE families SET name = ? WHERE id = ?")
    .bind(name, familyId)
    .run();

  const family = await getFamily(c.env.DB, familyId);

  return c.json({ family });
});

// Tilføj et nyt familiemedlem (fx et barn) — ejer/admin.
families.post("/:id/members", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan tilføje medlemmer." }, 403);
  }

  const body = await parseJsonBody<{
    name: string;
    color: string;
    relation: string | null;
  }>(c);

  if (!body.name?.trim() || !body.color?.trim()) {
    return c.json({ error: "Navn og farve er påkrævet." }, 400);
  }

  const memberId = crypto.randomUUID();
  const now = new Date().toISOString();

  // relation=NULL er reserveret til familie-pseudomedlemmet (sået ved
  // oprettelse) — det er sådan klienten kender forskel på det og et rigtigt
  // medlem uden valgt relation.
  await c.env.DB.prepare(
    `INSERT INTO family_members (id, family_id, name, color, relation, is_placeholder_name, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(
      memberId,
      familyId,
      body.name.trim(),
      body.color.trim(),
      body.relation ?? "Andet",
      now,
    )
    .run();

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Redigér et familiemedlem — ejer/admin.
families.patch("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan redigere medlemmer." }, 403);
  }

  const body = await parseJsonBody<{
    name: string;
    color: string;
    relation: string | null;
  }>(c);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name?.trim()) {
    updates.push("name = ?", "is_placeholder_name = 0");
    values.push(body.name.trim());
  }

  if (body.color?.trim()) {
    updates.push("color = ?");
    values.push(body.color.trim());
  }

  // relation=NULL er reserveret til familie-pseudomedlemmet — et almindeligt
  // medlem kan ikke få sin relation nulstillet til NULL via denne rute.
  if (body.relation !== undefined && body.relation !== null) {
    updates.push("relation = ?");
    values.push(body.relation);
  }

  if (updates.length > 0) {
    values.push(familyId, memberId);

    await c.env.DB.prepare(
      `UPDATE family_members SET ${updates.join(", ")} WHERE family_id = ? AND id = ?`,
    )
      .bind(...values)
      .run();
  }

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Kobl den nuværende bruger til et familiemedlem ("Min profil" i
// Indstillinger) — det er den kobling (linked_user_id), der afgør, om en
// personligt tildelt opgave/rutine kan sende en push til brugerens egen
// konto (se notifyForTask() i tasks.ts). Selvbetjening: ethvert
// familiemedlem må sætte dette på sig selv, ikke kun ejer/admin.
families.post("/:id/members/:memberId/link-me", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const member = await c.env.DB.prepare(
    "SELECT id, relation, linked_user_id AS linkedUserId FROM family_members WHERE id = ? AND family_id = ?",
  )
    .bind(memberId, familyId)
    .first<{ id: string; relation: string | null; linkedUserId: string | null }>();

  if (!member || member.relation === null) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  if (member.linkedUserId && member.linkedUserId !== user.id) {
    return c.json({ error: "Dette familiemedlem er allerede koblet til en anden konto." }, 409);
  }

  await c.env.DB.batch([
    // Kun ét medlem pr. bruger pr. familie — fjern en evt. tidligere
    // kobling, hvis brugeren skifter, hvem de vælger som "Min profil".
    c.env.DB.prepare(
      "UPDATE family_members SET linked_user_id = NULL WHERE family_id = ? AND linked_user_id = ?",
    ).bind(familyId, user.id),
    c.env.DB.prepare(
      "UPDATE family_members SET linked_user_id = ? WHERE id = ? AND family_id = ?",
    ).bind(user.id, memberId, familyId),
  ]);

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Fjern et familiemedlem — ejer/admin. "family"-pseudomedlemmet må ikke
// slettes, ligesom i den nuværende lokale model. Medlemmer sås med
// crypto.randomUUID() (se families.post("/") ovenfor), ikke seedets faste
// id'er — "id = 'family'" ville derfor aldrig matche noget rigtigt medlem,
// og pseudomedlemmet var reelt ubeskyttet. relation IS NULL er den samme
// reserverede markør, resten af denne fil allerede bruger til at kende
// pseudomedlemmet (se PATCH .../members/:memberId ovenfor).
families.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne medlemmer." }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM family_members WHERE family_id = ? AND id = ? AND relation IS NOT NULL",
  )
    .bind(familyId, memberId)
    .run();

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Skift en brugers rolle — kun ejeren kan forfremme/degradere admins. Ejerens
// egen rolle kan ikke ændres her (se transfer-ownership).
families.post("/:id/memberships/:userId/role", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || membership.role !== "owner") {
    return c.json({ error: "Kun ejeren kan ændre roller." }, 403);
  }

  const family = await getFamily(c.env.DB, familyId);

  if (family && targetUserId === family.ownerUserId) {
    return c.json({ error: "Ejerens rolle kan ikke ændres her — brug ejerskifte." }, 400);
  }

  const body = await parseJsonBody<{ role: string }>(c);

  if (body.role !== "admin" && body.role !== "member") {
    return c.json({ error: "Rolle skal være 'admin' eller 'member'." }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE family_memberships SET role = ? WHERE family_id = ? AND user_id = ?",
  )
    .bind(body.role, familyId, targetUserId)
    .run();

  return c.json({ ok: true });
});

// Overdrag ejerskab — tidligere ejer degraderes til admin, ikke fjernes.
families.post("/:id/transfer-ownership", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || membership.role !== "owner") {
    return c.json({ error: "Kun ejeren kan overdrage ejerskab." }, 403);
  }

  const body = await parseJsonBody<{ newOwnerUserId: string }>(c);
  const newOwnerUserId = body.newOwnerUserId;

  if (!newOwnerUserId) {
    return c.json({ error: "newOwnerUserId er påkrævet." }, 400);
  }

  const newOwnerMembership = await getMembershipForFamily(c.env.DB, familyId, newOwnerUserId);

  if (!newOwnerMembership) {
    return c.json({ error: "Den nye ejer skal allerede være medlem af familien." }, 400);
  }

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE families SET owner_user_id = ? WHERE id = ?").bind(
      newOwnerUserId,
      familyId,
    ),
    c.env.DB.prepare(
      "UPDATE family_memberships SET role = 'admin' WHERE family_id = ? AND user_id = ?",
    ).bind(familyId, user.id),
    c.env.DB.prepare(
      "UPDATE family_memberships SET role = 'owner' WHERE family_id = ? AND user_id = ?",
    ).bind(familyId, newOwnerUserId),
  ]);

  const family = await getFamily(c.env.DB, familyId);

  return c.json({ family });
});

// Fjern en brugers adgang til familien (ikke det samme som at slette et
// family_members-medlemsprofil) — ejer/admin, og ejeren kan ikke fjernes
// (skal overdrage ejerskab først).
families.delete("/:id/memberships/:userId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne medlemmer." }, 403);
  }

  const family = await getFamily(c.env.DB, familyId);

  if (family && targetUserId === family.ownerUserId) {
    return c.json({ error: "Ejeren kan ikke fjernes — overdrag ejerskab først." }, 400);
  }

  await c.env.DB.prepare(
    "DELETE FROM family_memberships WHERE family_id = ? AND user_id = ?",
  )
    .bind(familyId, targetUserId)
    .run();

  return c.json({ ok: true });
});

interface CalendarMemberMappingRow {
  googleCalendarId: string;
  familyMemberId: string;
}

async function listCalendarMemberMappings(
  db: D1Database,
  familyId: string,
): Promise<CalendarMemberMappingRow[]> {
  const result = await db
    .prepare(
      `SELECT google_calendar_id AS googleCalendarId, family_member_id AS familyMemberId
       FROM calendar_member_mappings WHERE family_id = ?`,
    )
    .bind(familyId)
    .all<CalendarMemberMappingRow>();

  return result.results;
}

// Alle kalender-til-medlem-tildelinger for familien (Fase 4) — enhver
// medlem må læse, ligesom resten af familiedata.
families.get("/:id/calendar-mappings", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const mappings = await listCalendarMemberMappings(c.env.DB, familyId);

  return c.json({ mappings });
});

// Sæt eller opdatér tildelingen for én kalender — ejer/admin, ligesom
// øvrig familiemedlem-administration.
families.put("/:id/calendar-mappings/:calendarId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const calendarId = c.req.param("calendarId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre kalender-tildelinger." }, 403);
  }

  const body = await parseJsonBody<{ familyMemberId: string }>(c);
  const familyMemberId = body.familyMemberId?.trim();

  if (!familyMemberId) {
    return c.json({ error: "familyMemberId er påkrævet." }, 400);
  }

  // family_members.id er en global primærnøgle på tværs af alle familier
  // (se ADR-017/Fase 2-noten om samme problem ved sletning), så uden dette
  // tjek kunne en admin i praksis knytte deres kalender til et medlem-id
  // fra en helt anden familie.
  const targetMember = await c.env.DB.prepare(
    "SELECT id FROM family_members WHERE id = ? AND family_id = ?",
  )
    .bind(familyMemberId, familyId)
    .first<{ id: string }>();

  if (!targetMember) {
    return c.json({ error: "Familiemedlemmet findes ikke i denne familie." }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id)
     VALUES (?, ?, ?)
     ON CONFLICT(family_id, google_calendar_id) DO UPDATE SET
       family_member_id = excluded.family_member_id`,
  )
    .bind(familyId, calendarId, familyMemberId)
    .run();

  const mappings = await listCalendarMemberMappings(c.env.DB, familyId);

  return c.json({ mappings });
});

// Fjern tildelingen for én kalender — ejer/admin.
families.delete("/:id/calendar-mappings/:calendarId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const calendarId = c.req.param("calendarId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre kalender-tildelinger." }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM calendar_member_mappings WHERE family_id = ? AND google_calendar_id = ?",
  )
    .bind(familyId, calendarId)
    .run();

  const mappings = await listCalendarMemberMappings(c.env.DB, familyId);

  return c.json({ mappings });
});

// Ryd ALLE tildelinger for familien — bruges ved eksplicit afbrydelse af en
// kalenderforbindelse, hvor gamle kalender-id'er ikke længere giver mening.
families.delete("/:id/calendar-mappings", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre kalender-tildelinger." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM calendar_member_mappings WHERE family_id = ?")
    .bind(familyId)
    .run();

  return c.json({ mappings: [] });
});

families.get("/:id", async (c) => {
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

export default families;
