// Sprint 55 (se 55_Sprint55_Barn_Adgang_UX_Plan.md): en voksens side af de
// korte beskeder til et familiemedlem — lib/childMessages.ts har den delte
// logik, som også bruges af barnets egen session (routes/childAccess.ts).

import { Hono } from "hono";

import type { Env } from "../../env";
import {
  childMessageMaxLength,
  createChildMessage,
  deleteChildMessage,
  isValidChildMessageBody,
  listChildMessagesForMember,
} from "../../lib/childMessages";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { parseJsonBody, type Variables } from "./familyQueries";

const childMessages = new Hono<{ Bindings: Env; Variables: Variables }>();

// Sprint 57: skærpet fra "relation IS NOT NULL" til "relation = 'Barn'" —
// beskeder er en børneadgangs-funktion (voksen → barn), ikke generel
// familie-besked, og må kun kunne sendes til/hentes for en reel
// børneprofil. Samme markør som childAccessManagement.ts's
// requireOwnerOrAdminMember.
async function isChildFamilyMember(db: D1Database, familyId: string, memberId: string): Promise<boolean> {
  const member = await db
    .prepare("SELECT id FROM family_members WHERE id = ? AND family_id = ? AND relation = 'Barn'")
    .bind(memberId, familyId)
    .first();

  return Boolean(member);
}

// Enhver logget ind familiemedlem må sende en besked — ikke kun ejer/admin,
// da en forælder uden admin-rolle stadig er en "autoriseret voksen" for sit
// eget barn (se planens "Ikke besluttet af mig"-afsnit).
childMessages.post("/:id/messages", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ familyMemberId: string; body: string }>(c);

  if (!body.familyMemberId || !(await isChildFamilyMember(c.env.DB, familyId, body.familyMemberId))) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  if (!isValidChildMessageBody(body.body)) {
    return c.json({ error: `Beskeden skal være mellem 1 og ${childMessageMaxLength} tegn.` }, 400);
  }

  const message = await createChildMessage(c.env.DB, {
    familyId,
    familyMemberId: body.familyMemberId,
    createdByUserId: user.id,
    body: body.body,
  });

  return c.json({ message });
});

// Samme familie-brede synlighed som opgaver/kalender allerede har (se
// privatlivspolitikkens "Data gemmes pr. familie") — markerer bevidst
// ALDRIG noget som læst herfra, så en forælders "Se som barn"-
// forhåndsvisning ikke fortrænger barnets egen læst-kvittering.
childMessages.get("/:id/messages", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const memberId = c.req.query("memberId");

  if (!memberId || !(await isChildFamilyMember(c.env.DB, familyId, memberId))) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  return c.json({ messages: await listChildMessagesForMember(c.env.DB, memberId) });
});

// Afsenderen selv eller ejer/admin kan fortryde en besked.
childMessages.delete("/:id/messages/:messageId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const messageId = c.req.param("messageId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const message = await c.env.DB.prepare(
    "SELECT id, created_by_user_id AS createdByUserId FROM child_messages WHERE id = ? AND family_id = ?",
  )
    .bind(messageId, familyId)
    .first<{ id: string; createdByUserId: string }>();

  if (!message) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const canDelete =
    message.createdByUserId === user.id || membership.role === "owner" || membership.role === "admin";

  if (!canDelete) {
    return c.json({ error: "Du kan kun slette dine egne beskeder." }, 403);
  }

  await deleteChildMessage(c.env.DB, familyId, messageId);

  return c.json({ ok: true });
});

export default childMessages;
