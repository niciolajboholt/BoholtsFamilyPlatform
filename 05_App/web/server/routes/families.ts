import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { familyMemberSeeds, generateInviteCode } from "../lib/familySeed";
import { getSessionUser, type SessionUser } from "../lib/session";

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
  console.error("Familie-API fejlede:", message);
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

interface MembershipRow {
  familyId: string;
  role: "owner" | "admin" | "member";
}

async function getMembership(
  db: D1Database,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await db
    .prepare(`SELECT family_id AS familyId, role FROM family_memberships WHERE user_id = ?`)
    .bind(userId)
    .first<MembershipRow>();

  return row ?? null;
}

async function getMembershipForFamily(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const row = await db
    .prepare(
      `SELECT family_id AS familyId, role FROM family_memberships WHERE family_id = ? AND user_id = ?`,
    )
    .bind(familyId, userId)
    .first<MembershipRow>();

  return row ?? null;
}

interface FamilyRow {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

async function getFamily(db: D1Database, familyId: string): Promise<FamilyRow | null> {
  const row = await db
    .prepare(
      `SELECT id, name, owner_user_id AS ownerUserId, created_at AS createdAt FROM families WHERE id = ?`,
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
    family: { id: familyId, name, ownerUserId: user.id, createdAt: now },
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

// Fjern et familiemedlem — ejer/admin. "family"-pseudomedlemmet må ikke
// slettes, ligesom i den nuværende lokale model.
families.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne medlemmer." }, 403);
  }

  await c.env.DB.prepare(
    "DELETE FROM family_members WHERE family_id = ? AND id = ? AND id != 'family'",
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

  if (!body.familyMemberId?.trim()) {
    return c.json({ error: "familyMemberId er påkrævet." }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO calendar_member_mappings (family_id, google_calendar_id, family_member_id)
     VALUES (?, ?, ?)
     ON CONFLICT(family_id, google_calendar_id) DO UPDATE SET
       family_member_id = excluded.family_member_id`,
  )
    .bind(familyId, calendarId, body.familyMemberId.trim())
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
