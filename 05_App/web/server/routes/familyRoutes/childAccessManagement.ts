// Sprint 53: ejer/admin-siden af børneadgang — genererer/roterer det
// ugættelige child_access_token og sætter/rydder PIN-koden, som
// routes/childAccess.ts (den offentlige, ikke-loggede-ind side) læser.
// Se 53_Sprint53_Barn_Pinkode_Adgang_Plan.md for hele designet.

import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { generateShareToken } from "../../lib/familySeed";
import { hashPin, isValidPinFormat } from "../../lib/pinHashing";
import { parseJsonBody, type Variables } from "./familyQueries";

const childAccessManagement = new Hono<{ Bindings: Env; Variables: Variables }>();

interface ChildAccessMemberRow {
  id: string;
  childAccessToken: string | null;
  pinSetAt: string | null;
}

async function requireOwnerOrAdminMember(
  db: D1Database,
  familyId: string,
  memberId: string,
): Promise<ChildAccessMemberRow | null> {
  const member = await db
    .prepare(
      `SELECT id, child_access_token AS childAccessToken, pin_set_at AS pinSetAt
       FROM family_members WHERE id = ? AND family_id = ? AND relation IS NOT NULL`,
    )
    .bind(memberId, familyId)
    .first<ChildAccessMemberRow>();

  return member ?? null;
}

// Status bruges af FamilyMemberDialog til at vise "link oprettet"/"kode
// sat" uden selv at afsløre PIN-koden (kun hasPin, aldrig hash'en).
childAccessManagement.get("/:id/members/:memberId/child-access", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan se dette." }, 403);
  }

  const member = await requireOwnerOrAdminMember(c.env.DB, familyId, memberId);

  if (!member) {
    return c.json({ error: "Ukendt familiemedlem." }, 404);
  }

  return c.json({
    token: member.childAccessToken,
    hasPin: member.pinSetAt !== null,
    pinSetAt: member.pinSetAt,
  });
});

// Opret/regenerér linket — et gammelt token holder op med at virke med det
// samme (samme "regenerér overskriver" mønster som family_share_links).
// Aktive child_sessions ryddes samtidig, så et roteret link (fx fordi
// enheden er mistet) ikke lader en allerede logget-ind enhed blive siddende.
childAccessManagement.post("/:id/members/:memberId/child-access/token", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan oprette et børneadgangs-link." }, 403);
  }

  const member = await requireOwnerOrAdminMember(c.env.DB, familyId, memberId);

  if (!member) {
    return c.json({ error: "Ukendt familiemedlem." }, 404);
  }

  const token = generateShareToken();

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE family_members SET child_access_token = ? WHERE id = ?").bind(token, memberId),
    c.env.DB.prepare("DELETE FROM child_sessions WHERE family_member_id = ?").bind(memberId),
  ]);

  return c.json({ token });
});

// Deaktivér linket helt (og log evt. aktive enheder ud) — nulstiller også
// PIN-koden, så et senere nyt link ikke arver den gamle kode uden at nogen
// aktivt har sat den igen.
childAccessManagement.delete("/:id/members/:memberId/child-access/token", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne et børneadgangs-link." }, 403);
  }

  const member = await requireOwnerOrAdminMember(c.env.DB, familyId, memberId);

  if (!member) {
    return c.json({ error: "Ukendt familiemedlem." }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE family_members SET child_access_token = NULL, pin_hash = NULL, pin_set_at = NULL WHERE id = ?",
    ).bind(memberId),
    c.env.DB.prepare("DELETE FROM child_sessions WHERE family_member_id = ?").bind(memberId),
  ]);

  return c.json({ ok: true });
});

// Sæt/ændr PIN-koden — kræver at linket allerede er oprettet (en PIN uden
// et token kan aldrig bruges til noget, se routes/childAccess.ts).
childAccessManagement.put("/:id/members/:memberId/child-access/pin", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan sætte en kode." }, 403);
  }

  const member = await requireOwnerOrAdminMember(c.env.DB, familyId, memberId);

  if (!member) {
    return c.json({ error: "Ukendt familiemedlem." }, 404);
  }

  if (!member.childAccessToken) {
    return c.json({ error: "Opret linket, før der sættes en kode." }, 400);
  }

  const body = await parseJsonBody<{ pin: string }>(c);
  const pin = body.pin ?? "";

  if (!isValidPinFormat(pin)) {
    return c.json({ error: "Koden skal være præcis 4 cifre." }, 400);
  }

  const pinHash = await hashPin(pin);
  const now = new Date().toISOString();

  await c.env.DB.prepare("UPDATE family_members SET pin_hash = ?, pin_set_at = ? WHERE id = ?")
    .bind(pinHash, now, memberId)
    .run();

  return c.json({ ok: true, pinSetAt: now });
});

// Ryd PIN-koden uden at fjerne selve linket — barnet kan derefter ikke
// logge ind før en voksen sætter en ny kode (samme "ikke sat endnu"-fejl
// som routes/childAccess.ts allerede håndterer).
childAccessManagement.delete("/:id/members/:memberId/child-access/pin", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan rydde koden." }, 403);
  }

  const member = await requireOwnerOrAdminMember(c.env.DB, familyId, memberId);

  if (!member) {
    return c.json({ error: "Ukendt familiemedlem." }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE family_members SET pin_hash = NULL, pin_set_at = NULL WHERE id = ?").bind(memberId),
    c.env.DB.prepare("DELETE FROM child_sessions WHERE family_member_id = ?").bind(memberId),
  ]);

  return c.json({ ok: true });
});

export default childAccessManagement;
