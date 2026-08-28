import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { parseJsonBody, type Variables } from "./familyQueries";

// Fase 9: en delt kalender tilføjet via et ICS-link (Googles "hemmelige
// iCal-adresse", Outlooks offentlige kalenderlink, en skole-/
// idrætskalender osv.) — skrivebeskyttet, ingen OAuth til kildens konto.
// Denne fil dækker kun selve abonnements-administrationen (opret/list/
// redigér/slet + loft). Selve hentningen/parsningen af feedet (en ny
// server-proxy med SSRF-hærdning, ICS-parsing, RRULE-udfoldning) er en
// selvstændig, efterfølgende PR — se 30_Stabilization_Execution_Plan.md's
// Fase 9.

const icsSubscriptions = new Hono<{ Bindings: Env; Variables: Variables }>();

// Håndhæves her (applikationslaget), ikke i skemaet — samme princip som
// andre forretningsregler i denne kodebase (fx invite-accept-raten i
// familyCore.ts). Holder UI'et overskueligt og begrænser fremtidig
// proxy-udnyttelse.
const maxSubscriptionsPerFamily = 5;

export interface IcsCalendarSubscriptionRow {
  id: string;
  familyId: string;
  url: string;
  label: string;
  familyMemberId: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: string | null;
  createdAt: string;
}

async function listIcsSubscriptions(
  db: D1Database,
  familyId: string,
): Promise<IcsCalendarSubscriptionRow[]> {
  const result = await db
    .prepare(
      `SELECT id, family_id AS familyId, url, label, family_member_id AS familyMemberId,
              last_fetched_at AS lastFetchedAt, last_fetch_status AS lastFetchStatus,
              created_at AS createdAt
       FROM ics_calendar_subscriptions WHERE family_id = ? ORDER BY created_at ASC`,
    )
    .bind(familyId)
    .all<IcsCalendarSubscriptionRow>();

  return result.results;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// Alle abonnementer for familien — enhver medlem må læse, ligesom
// calendar_member_mappings.
icsSubscriptions.get("/:id/ics-subscriptions", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const subscriptions = await listIcsSubscriptions(c.env.DB, familyId);

  return c.json({ subscriptions });
});

// Opret et nyt abonnement — ejer/admin, ligesom øvrig familiemedlem-
// administration. Selve URL'en valideres kun for gyldigt skema her;
// egentlig nåbarheds-/SSRF-kontrol sker i den kommende hentnings-rute, ikke
// her, hvor der endnu intet netværkskald er.
icsSubscriptions.post("/:id/ics-subscriptions", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan tilføje en kalenderabonnement." }, 403);
  }

  const existing = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM ics_calendar_subscriptions WHERE family_id = ?",
  )
    .bind(familyId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) >= maxSubscriptionsPerFamily) {
    return c.json(
      { error: `En familie kan højst have ${maxSubscriptionsPerFamily} kalenderabonnementer.` },
      409,
    );
  }

  const body = await parseJsonBody<{ url: string; label: string; familyMemberId?: string | null }>(c);
  const url = body.url?.trim();
  const label = body.label?.trim();
  const familyMemberId = body.familyMemberId?.trim() || null;

  if (!url || !isValidHttpUrl(url)) {
    return c.json({ error: "Angiv et gyldigt kalenderlink (http:// eller https://)." }, 400);
  }

  if (!label) {
    return c.json({ error: "Angiv et navn for kalenderen." }, 400);
  }

  if (familyMemberId) {
    // family_members.id er en global primærnøgle på tværs af alle familier
    // (samme tjek som calendarMappings.ts) — uden dette kunne et abonnement
    // tildeles et medlem-id fra en helt anden familie.
    const targetMember = await c.env.DB.prepare(
      "SELECT id FROM family_members WHERE id = ? AND family_id = ?",
    )
      .bind(familyMemberId, familyId)
      .first<{ id: string }>();

    if (!targetMember) {
      return c.json({ error: "Familiemedlemmet findes ikke i denne familie." }, 400);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO ics_calendar_subscriptions
       (id, family_id, url, label, family_member_id, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, familyId, url, label, familyMemberId, user.id, now)
    .run();

  const subscriptions = await listIcsSubscriptions(c.env.DB, familyId);

  return c.json({ subscriptions });
});

// Omdøb, gentildel eller skift URL på et eksisterende abonnement — ejer/
// admin. Alle felter er valgfri i requesten; kun de angivne opdateres.
icsSubscriptions.patch("/:id/ics-subscriptions/:subscriptionId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const subscriptionId = c.req.param("subscriptionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre et kalenderabonnement." }, 403);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM ics_calendar_subscriptions WHERE id = ? AND family_id = ?",
  )
    .bind(subscriptionId, familyId)
    .first<{ id: string }>();

  if (!existing) {
    return c.json({ error: "Abonnementet findes ikke i denne familie." }, 404);
  }

  const body = await parseJsonBody<{ url: string; label: string; familyMemberId: string | null }>(c);

  if (body.url !== undefined) {
    const url = body.url?.trim();
    if (!url || !isValidHttpUrl(url)) {
      return c.json({ error: "Angiv et gyldigt kalenderlink (http:// eller https://)." }, 400);
    }
    await c.env.DB.prepare("UPDATE ics_calendar_subscriptions SET url = ? WHERE id = ?")
      .bind(url, subscriptionId)
      .run();
  }

  if (body.label !== undefined) {
    const label = body.label?.trim();
    if (!label) {
      return c.json({ error: "Angiv et navn for kalenderen." }, 400);
    }
    await c.env.DB.prepare("UPDATE ics_calendar_subscriptions SET label = ? WHERE id = ?")
      .bind(label, subscriptionId)
      .run();
  }

  if (body.familyMemberId !== undefined) {
    const familyMemberId = body.familyMemberId?.trim() || null;

    if (familyMemberId) {
      const targetMember = await c.env.DB.prepare(
        "SELECT id FROM family_members WHERE id = ? AND family_id = ?",
      )
        .bind(familyMemberId, familyId)
        .first<{ id: string }>();

      if (!targetMember) {
        return c.json({ error: "Familiemedlemmet findes ikke i denne familie." }, 400);
      }
    }

    await c.env.DB.prepare("UPDATE ics_calendar_subscriptions SET family_member_id = ? WHERE id = ?")
      .bind(familyMemberId, subscriptionId)
      .run();
  }

  const subscriptions = await listIcsSubscriptions(c.env.DB, familyId);

  return c.json({ subscriptions });
});

// Fjern et abonnement — ejer/admin.
icsSubscriptions.delete("/:id/ics-subscriptions/:subscriptionId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const subscriptionId = c.req.param("subscriptionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne et kalenderabonnement." }, 403);
  }

  await c.env.DB.prepare("DELETE FROM ics_calendar_subscriptions WHERE id = ? AND family_id = ?")
    .bind(subscriptionId, familyId)
    .run();

  const subscriptions = await listIcsSubscriptions(c.env.DB, familyId);

  return c.json({ subscriptions });
});

export default icsSubscriptions;
