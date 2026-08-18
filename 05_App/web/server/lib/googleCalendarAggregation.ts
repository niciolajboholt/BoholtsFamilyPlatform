// Sprint 26: bruges udelukkende af det offentlige, uautentificerede
// /api/public/family-calendar/:token-endpoint (server/routes/publicCalendar.ts)
// til at hente og aggregere de valgte familiemedlemmers Google-kalendere
// server-side — ingen adgangstoken eller andre hemmeligheder returneres
// nogensinde til klienten, kun de færdig-formaterede aftaler.

import type { Env } from "../env";
import { getGoogleAccessToken } from "./googleConnection";

const googleCalendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export interface PublicCalendarEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  memberName: string;
  memberColor: string;
}

interface CalendarMappingRow {
  googleCalendarId: string;
  memberName: string;
  memberColor: string;
}

function mapEvent(
  event: GoogleCalendarEvent,
  memberName: string,
  memberColor: string,
): PublicCalendarEvent | null {
  if (!event.id || event.status === "cancelled") {
    return null;
  }

  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = allDay ? `${event.start?.date}T00:00:00.000Z` : event.start?.dateTime;
  const end = allDay ? `${event.end?.date}T00:00:00.000Z` : event.end?.dateTime;

  if (!start || !end) {
    return null;
  }

  return {
    title: event.summary || "Aftale",
    start,
    end,
    allDay,
    description: event.description,
    location: event.location,
    memberName,
    memberColor,
  };
}

async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  range: { start: string; end: string },
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `${googleCalendarApiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set("timeMin", range.start);
    url.searchParams.set("timeMax", range.end);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      // Én kalender der fejler (fx slettet i Google efter linket blev
      // oprettet) skal ikke vælte hele den offentlige visning — spring den
      // over og returnér det, der allerede er hentet.
      return events;
    }

    const payload = await response.json<GoogleCalendarEventsResponse>();
    events.push(...(payload.items ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return events;
}

/**
 * Henter aftaler for de valgte familiemedlemmers Google-kalendere, drevet
 * af opretterens (createdByUserId) Google-forbindelse — se beslutning 4 i
 * 26_Sprint26_Konflikter_Delelink_Plan.md. Medlems-tildelingen slås op
 * dynamisk her, ikke fra et statisk snapshot på selve delelinket.
 */
export async function fetchPublicFamilyCalendarEvents(
  env: Env,
  familyId: string,
  createdByUserId: string,
  includedMemberIds: string[],
  range: { start: string; end: string },
): Promise<PublicCalendarEvent[]> {
  if (includedMemberIds.length === 0) {
    return [];
  }

  const placeholders = includedMemberIds.map(() => "?").join(",");
  const mappings = await env.DB.prepare(
    `SELECT cmm.google_calendar_id AS googleCalendarId,
            fm.name AS memberName, fm.color AS memberColor
     FROM calendar_member_mappings cmm
     JOIN family_members fm ON fm.id = cmm.family_member_id
     WHERE cmm.family_id = ? AND cmm.family_member_id IN (${placeholders})`,
  )
    .bind(familyId, ...includedMemberIds)
    .all<CalendarMappingRow>();

  if (mappings.results.length === 0) {
    return [];
  }

  const accessToken = await getGoogleAccessToken(env, createdByUserId);

  const eventsByCalendar = await Promise.all(
    mappings.results.map(async (mapping) => {
      const events = await fetchGoogleCalendarEvents(accessToken, mapping.googleCalendarId, range);

      return events
        .map((event) => mapEvent(event, mapping.memberName, mapping.memberColor))
        .filter((event): event is PublicCalendarEvent => event !== null);
    }),
  );

  return eventsByCalendar.flat();
}
