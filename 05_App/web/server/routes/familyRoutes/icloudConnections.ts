import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import {
  createIcloudConnection,
  createCalendarEvent,
  deleteCalendarEvent,
  deleteIcloudConnection,
  getCalendarEvents,
  IcloudConnectionNotFoundError,
  icloudErrorStatus,
  listCalendarsForConnection,
  listIcloudConnections,
  updateCalendarEvent,
  ICloudCalDavError,
} from "../../lib/icloudCalendarService";
import { parseJsonBody, type Variables } from "./familyQueries";

// Sprint 47 (se 47_Sprint47_iCloud_Kalender_CalDAV_Plan.md): iCloud-kalender
// via CalDAV. Forbindelserne administreres familie-scoped, ét medlem pr.
// egen iCloud-konto — samme mønster som ics_calendar_subscriptions.ts, ikke
// Googles enkelt-ejer-model (se calendar.ts). I modsætning til ICS er
// forbindelsen fuldt læs/skriv/redigér/slet fra dag ét (Nicolajs
// beslutning), så denne fil dækker både forbindelses-CRUD OG selve
// hændelses-proxyen mod iCloud.
//
// Kalender-URL'er og hændelses-href'er fra CalDAV er hele URL'er, ikke korte
// opaque id'er (i modsætning til Googles calendarId/eventId) — de sendes
// derfor i request-body/query i stedet for som stinavne, så ingen
// dobbelt-URL-encoding er nødvendig.

const icloudConnections = new Hono<{ Bindings: Env; Variables: Variables }>();

const maxConnectionsPerFamily = 5;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function icloudErrorResponse(error: unknown): { message: string; status: 401 | 404 | 409 | 502 | 504 } {
  if (error instanceof ICloudCalDavError) {
    return { message: error.message, status: icloudErrorStatus(error.code) };
  }
  return { message: "Kunne ikke kontakte iCloud.", status: 502 };
}

icloudConnections.get("/:id/icloud-connections", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const connections = await listIcloudConnections(c.env.DB, familyId);
  return c.json({ connections });
});

icloudConnections.post("/:id/icloud-connections", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan tilføje en iCloud-forbindelse." }, 403);
  }

  const existing = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM icloud_calendar_connections WHERE family_id = ?",
  )
    .bind(familyId)
    .first<{ count: number }>();

  if ((existing?.count ?? 0) >= maxConnectionsPerFamily) {
    return c.json(
      { error: `En familie kan højst have ${maxConnectionsPerFamily} iCloud-forbindelser.` },
      409,
    );
  }

  const body = await parseJsonBody<{
    appleIdEmail: string;
    appSpecificPassword: string;
    familyMemberId?: string | null;
  }>(c);
  const appleIdEmail = body.appleIdEmail?.trim();
  const appSpecificPassword = body.appSpecificPassword?.trim();
  const familyMemberId = body.familyMemberId?.trim() || null;

  if (!appleIdEmail || !isValidEmail(appleIdEmail)) {
    return c.json({ error: "Angiv en gyldig Apple-ID e-mail." }, 400);
  }

  if (!appSpecificPassword) {
    return c.json({ error: "Angiv den app-specifikke adgangskode." }, 400);
  }

  if (familyMemberId) {
    // family_members.id er en global primærnøgle på tværs af alle familier
    // (samme tjek som calendarMappings.ts/icsSubscriptions.ts).
    const targetMember = await c.env.DB.prepare(
      "SELECT id FROM family_members WHERE id = ? AND family_id = ?",
    )
      .bind(familyMemberId, familyId)
      .first<{ id: string }>();

    if (!targetMember) {
      return c.json({ error: "Familiemedlemmet findes ikke i denne familie." }, 400);
    }
  }

  try {
    await createIcloudConnection(c.env, c.env.DB, {
      familyId,
      appleIdEmail,
      appSpecificPassword,
      familyMemberId,
      createdByUserId: user.id,
    });
  } catch (error) {
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }

  const connections = await listIcloudConnections(c.env.DB, familyId);
  return c.json({ connections });
});

icloudConnections.delete("/:id/icloud-connections/:connectionId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan fjerne en iCloud-forbindelse." }, 403);
  }

  await deleteIcloudConnection(c.env.DB, familyId, connectionId);

  const connections = await listIcloudConnections(c.env.DB, familyId);
  return c.json({ connections });
});

// Enhver medlem må læse/oprette/redigere/slette hændelser — samme
// skrive-niveau som Google (proxyToGoogle i calendar.ts er heller ikke
// ejer/admin-begrænset), i modsætning til selve forbindelsesadministrationen
// ovenfor.
icloudConnections.get("/:id/icloud-connections/:connectionId/calendars", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  try {
    const calendars = await listCalendarsForConnection(c.env, c.env.DB, familyId, connectionId);
    return c.json({ calendars });
  } catch (error) {
    if (error instanceof IcloudConnectionNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }
});

function defaultIcloudEventRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
}

icloudConnections.get("/:id/icloud-connections/:connectionId/events", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const calendarUrl = c.req.query("calendarUrl");
  if (!calendarUrl) {
    return c.json({ error: "calendarUrl mangler." }, 400);
  }

  const queryStart = c.req.query("start");
  const queryEnd = c.req.query("end");
  const range =
    queryStart && queryEnd ? { start: queryStart, end: queryEnd } : defaultIcloudEventRange();

  try {
    const events = await getCalendarEvents(c.env, c.env.DB, familyId, connectionId, calendarUrl, range);
    return c.json({ events });
  } catch (error) {
    if (error instanceof IcloudConnectionNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }
});

icloudConnections.post("/:id/icloud-connections/:connectionId/events", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    calendarUrl: string;
    title: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
  }>(c);

  if (!body.calendarUrl || !body.title?.trim() || !body.start || !body.end) {
    return c.json({ error: "calendarUrl, title, start og end skal angives." }, 400);
  }

  const uid = crypto.randomUUID();

  try {
    const result = await createCalendarEvent(c.env, c.env.DB, familyId, connectionId, body.calendarUrl, {
      uid,
      title: body.title.trim(),
      start: body.start,
      end: body.end,
      description: body.description,
      location: body.location,
    });
    return c.json({ uid, href: result.href, etag: result.etag });
  } catch (error) {
    if (error instanceof IcloudConnectionNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }
});

icloudConnections.patch("/:id/icloud-connections/:connectionId/events", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    calendarUrl: string;
    uid: string;
    title: string;
    start: string;
    end: string;
    description?: string;
    location?: string;
    etag: string;
  }>(c);

  if (!body.calendarUrl || !body.uid || !body.title?.trim() || !body.start || !body.end || !body.etag) {
    return c.json({ error: "calendarUrl, uid, title, start, end og etag skal angives." }, 400);
  }

  try {
    const result = await updateCalendarEvent(
      c.env,
      c.env.DB,
      familyId,
      connectionId,
      body.calendarUrl,
      {
        uid: body.uid,
        title: body.title.trim(),
        start: body.start,
        end: body.end,
        description: body.description,
        location: body.location,
      },
      body.etag,
    );
    return c.json({ uid: body.uid, href: result.href, etag: result.etag });
  } catch (error) {
    if (error instanceof IcloudConnectionNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }
});

icloudConnections.delete("/:id/icloud-connections/:connectionId/events", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const connectionId = c.req.param("connectionId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ eventHref: string; etag: string }>(c);

  if (!body.eventHref || !body.etag) {
    return c.json({ error: "eventHref og etag skal angives." }, 400);
  }

  try {
    await deleteCalendarEvent(c.env, c.env.DB, familyId, connectionId, body.eventHref, body.etag);
    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof IcloudConnectionNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    const { message, status } = icloudErrorResponse(error);
    return c.json({ error: message }, status);
  }
});

export default icloudConnections;
