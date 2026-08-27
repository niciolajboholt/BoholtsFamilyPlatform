// Sprint 31: tidsbaserede påmindelser pr. Google-kalenderaftale. Ruterne her
// læser/skriver kun konfigurationen (server/lib/eventReminders.ts sender de
// faktiske push-notifikationer, drevet af det eksisterende 5-minutters
// cron-tick).

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { logError } from "../lib/structuredLog";
import { getMembershipForFamily } from "../lib/familyMembership";
import { GoogleNotConnectedError, getGoogleAccessToken } from "../lib/googleConnection";
import { decodeGoogleEventId, encodeGoogleEventId } from "../lib/googleEventIds";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };
type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const eventReminders = new Hono<{ Bindings: Env; Variables: Variables }>();

const googleCalendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";

// Kun disse tilbydes i UI'et — holdes i sync med klientens
// eventReminderApi.ts. Valideres her, så et vilkårligt tal ikke kan sendes
// direkte til API'et uden om UI'et.
export const allowedOffsetMinutes = [10, 30, 60, 24 * 60, 3 * 24 * 60] as const;

eventReminders.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Aftale-påmindelse-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

eventReminders.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

async function requireFamilyMembership(
  c: AppContext,
  familyId: string,
): Promise<boolean> {
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);
  return membership !== null;
}

interface FamilyRow {
  ownerUserId: string;
}

// En gentagende aftales påmindelse gemmes altid mod SELVE RÆKKEN (Googles
// "recurringEventId"), ikke den ene forekomst brugeren stod på i dialogen —
// ellers ville en fødselsdagspåmindelse kun ramme det ene år, den blev sat.
// Falder tilbage til det oprindeligt givne id, hvis Google-kaldet fejler
// (fx en midlertidig netværksfejl) — bedre at gemme mod den konkrete
// forekomst end at fejle handlingen helt.
async function resolveCanonicalEventId(
  env: Env,
  ownerUserId: string,
  calendarId: string,
  googleEventId: string,
): Promise<string> {
  const fallback = encodeGoogleEventId(calendarId, googleEventId);

  try {
    const accessToken = await getGoogleAccessToken(env, ownerUserId);
    const response = await fetch(
      `${googleCalendarApiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      return fallback;
    }

    const event = await response.json<{ recurringEventId?: string }>();

    return event.recurringEventId
      ? encodeGoogleEventId(calendarId, event.recurringEventId)
      : fallback;
  } catch {
    return fallback;
  }
}

interface EventReminderRow {
  id: string;
  offsetMinutes: number;
}

async function findReminder(
  db: D1Database,
  familyId: string,
  canonicalEventId: string,
): Promise<EventReminderRow | null> {
  const row = await db
    .prepare(
      "SELECT id, offset_minutes AS offsetMinutes FROM event_reminders WHERE family_id = ? AND event_id = ?",
    )
    .bind(familyId, canonicalEventId)
    .first<EventReminderRow>();

  return row ?? null;
}

async function resolveOwnerAndCanonicalId(
  c: AppContext,
  familyId: string,
): Promise<{ ownerUserId: string; canonicalEventId: string } | null> {
  const family = await c.env.DB.prepare("SELECT owner_user_id AS ownerUserId FROM families WHERE id = ?")
    .bind(familyId)
    .first<FamilyRow>();

  if (!family) {
    return null;
  }

  const decoded = decodeGoogleEventId(c.req.param("eventId")!);

  if (!decoded) {
    return null;
  }

  try {
    const canonicalEventId = await resolveCanonicalEventId(
      c.env,
      family.ownerUserId,
      decoded.calendarId,
      decoded.eventId,
    );

    return { ownerUserId: family.ownerUserId, canonicalEventId };
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      return null;
    }

    throw error;
  }
}

eventReminders.get("/:id/event-reminders/:eventId", async (c) => {
  const familyId = c.req.param("id");

  if (!(await requireFamilyMembership(c, familyId))) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const resolved = await resolveOwnerAndCanonicalId(c, familyId);

  if (!resolved) {
    return c.json({ error: "Aftalen kunne ikke findes." }, 404);
  }

  const reminder = await findReminder(c.env.DB, familyId, resolved.canonicalEventId);

  return c.json({
    reminder: reminder ? { offsetMinutes: reminder.offsetMinutes } : null,
  });
});

eventReminders.put("/:id/event-reminders/:eventId", async (c) => {
  const familyId = c.req.param("id");

  if (!(await requireFamilyMembership(c, familyId))) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await c.req
    .json<{ offsetMinutes?: number }>()
    .catch(() => ({}) as { offsetMinutes?: number });

  if (
    typeof body.offsetMinutes !== "number" ||
    !(allowedOffsetMinutes as readonly number[]).includes(body.offsetMinutes)
  ) {
    return c.json({ error: "Ugyldigt påmindelsestidspunkt." }, 400);
  }

  const resolved = await resolveOwnerAndCanonicalId(c, familyId);

  if (!resolved) {
    return c.json({ error: "Aftalen kunne ikke findes." }, 404);
  }

  const existing = await findReminder(c.env.DB, familyId, resolved.canonicalEventId);
  const userId = c.get("user").id;

  if (existing) {
    await c.env.DB.prepare("UPDATE event_reminders SET offset_minutes = ? WHERE id = ?")
      .bind(body.offsetMinutes, existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO event_reminders (id, family_id, event_id, offset_minutes, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        familyId,
        resolved.canonicalEventId,
        body.offsetMinutes,
        userId,
        new Date().toISOString(),
      )
      .run();
  }

  return c.json({ reminder: { offsetMinutes: body.offsetMinutes } });
});

eventReminders.delete("/:id/event-reminders/:eventId", async (c) => {
  const familyId = c.req.param("id");

  if (!(await requireFamilyMembership(c, familyId))) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const resolved = await resolveOwnerAndCanonicalId(c, familyId);

  if (!resolved) {
    return c.json({ error: "Aftalen kunne ikke findes." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM event_reminders WHERE family_id = ? AND event_id = ?")
    .bind(familyId, resolved.canonicalEventId)
    .run();

  return c.json({ reminder: null });
});

export default eventReminders;
