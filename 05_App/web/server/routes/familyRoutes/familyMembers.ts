import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import {
  getFamily,
  listFamilyMembers,
  listFamilyMemberships,
  parseJsonBody,
  type Variables,
} from "./familyQueries";

const familyMembers = new Hono<{ Bindings: Env; Variables: Variables }>();

// Familiens konti (ikke at forveksle med family_members-profilerne
// ovenfor) med deres rolle — grundlaget for rolle-/adgangsadministrations-
// UI'et. Enhver medlem må læse, ligesom resten af familiedata; kun
// rolleændring/fjernelse nedenfor kræver ejer/admin.
familyMembers.get("/:id/memberships", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const memberships = await listFamilyMemberships(c.env.DB, familyId);

  return c.json({ memberships });
});

// Tilføj et nyt familiemedlem (fx et barn) — ejer/admin.
familyMembers.post("/:id/members", async (c) => {
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
    .bind(memberId, familyId, body.name.trim(), body.color.trim(), body.relation ?? "Andet", now)
    .run();

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Redigér et familiemedlem — ejer/admin.
familyMembers.patch("/:id/members/:memberId", async (c) => {
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

    await c.env.DB.prepare(`UPDATE family_members SET ${updates.join(", ")} WHERE family_id = ? AND id = ?`)
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
familyMembers.post("/:id/members/:memberId/link-me", async (c) => {
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
    c.env.DB.prepare("UPDATE family_members SET linked_user_id = ? WHERE id = ? AND family_id = ?").bind(
      user.id,
      memberId,
      familyId,
    ),
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
familyMembers.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne medlemmer." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM family_members WHERE family_id = ? AND id = ? AND relation IS NOT NULL")
    .bind(familyId, memberId)
    .run();

  const members = await listFamilyMembers(c.env.DB, familyId);

  return c.json({ members });
});

// Skift en brugers rolle — kun ejeren kan forfremme/degradere admins. Ejerens
// egen rolle kan ikke ændres her (se transfer-ownership).
familyMembers.post("/:id/memberships/:userId/role", async (c) => {
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

  await c.env.DB.prepare("UPDATE family_memberships SET role = ? WHERE family_id = ? AND user_id = ?")
    .bind(body.role, familyId, targetUserId)
    .run();

  return c.json({ ok: true });
});

// Overdrag ejerskab — tidligere ejer degraderes til admin, ikke fjernes.
familyMembers.post("/:id/transfer-ownership", async (c) => {
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
    c.env.DB.prepare("UPDATE families SET owner_user_id = ? WHERE id = ?").bind(newOwnerUserId, familyId),
    c.env.DB.prepare("UPDATE family_memberships SET role = 'admin' WHERE family_id = ? AND user_id = ?").bind(
      familyId,
      user.id,
    ),
    c.env.DB.prepare("UPDATE family_memberships SET role = 'owner' WHERE family_id = ? AND user_id = ?").bind(
      familyId,
      newOwnerUserId,
    ),
  ]);

  const family = await getFamily(c.env.DB, familyId);

  return c.json({ family });
});

// Fjern en brugers adgang til familien (ikke det samme som at slette et
// family_members-medlemsprofil) — ejer/admin, og ejeren kan ikke fjernes
// (skal overdrage ejerskab først).
familyMembers.delete("/:id/memberships/:userId", async (c) => {
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

  await c.env.DB.prepare("DELETE FROM family_memberships WHERE family_id = ? AND user_id = ?")
    .bind(familyId, targetUserId)
    .run();

  return c.json({ ok: true });
});

export default familyMembers;
