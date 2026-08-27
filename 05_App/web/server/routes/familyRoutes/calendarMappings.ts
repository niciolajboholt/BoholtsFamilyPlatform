import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { listCalendarMemberMappings, parseJsonBody, type Variables } from "./familyQueries";

const calendarMappings = new Hono<{ Bindings: Env; Variables: Variables }>();

// Alle kalender-til-medlem-tildelinger for familien (Fase 4) — enhver
// medlem må læse, ligesom resten af familiedata.
calendarMappings.get("/:id/calendar-mappings", async (c) => {
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
calendarMappings.put("/:id/calendar-mappings/:calendarId", async (c) => {
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
  const targetMember = await c.env.DB.prepare("SELECT id FROM family_members WHERE id = ? AND family_id = ?")
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
calendarMappings.delete("/:id/calendar-mappings/:calendarId", async (c) => {
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
calendarMappings.delete("/:id/calendar-mappings", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre kalender-tildelinger." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM calendar_member_mappings WHERE family_id = ?").bind(familyId).run();

  return c.json({ mappings: [] });
});

export default calendarMappings;
