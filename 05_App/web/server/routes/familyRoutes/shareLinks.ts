import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { generateShareToken } from "../../lib/familySeed";
import {
  parseIncludedMemberIds,
  parseJsonBody,
  type ShareLinkRow,
  type Variables,
} from "./familyQueries";

const shareLinks = new Hono<{ Bindings: Env; Variables: Variables }>();

// Familiens aktive delelink, hvis nogen — bruges af Indstillinger til at
// vise den aktuelle status uden at skulle regenerere for at se den.
shareLinks.get("/:id/share-link", async (c) => {
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
shareLinks.post("/:id/share-link", async (c) => {
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

  const existingMembers = await c.env.DB.prepare("SELECT id FROM family_members WHERE family_id = ?")
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
shareLinks.delete("/:id/share-link", async (c) => {
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

export default shareLinks;
