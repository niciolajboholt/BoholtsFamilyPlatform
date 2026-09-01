import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type {
  GoogleCalendarAccessRole,
  GoogleCalendarListEntry,
  GoogleCalendarEvent,
} from "./googleCalendarTypes";
import {
  encodeGoogleCalendarSourceId,
  encodeGoogleEventId,
} from "./googleCalendarIds";
import { matchAttendeesToOwnerIds } from "../../utils/matchAttendeesToOwnerIds";

const fallbackColor = "#607d8b";

export function isGoogleCalendarWritable(
  accessRole: string | undefined,
): boolean {
  const normalizedRole = toGoogleCalendarAccessRole(accessRole);
  return normalizedRole === "owner" || normalizedRole === "writer";
}

function toGoogleCalendarAccessRole(
  accessRole: string | undefined,
): GoogleCalendarAccessRole | undefined {
  switch (accessRole) {
    case "owner":
    case "writer":
    case "reader":
    case "freeBusyReader":
      return accessRole;
    default:
      return undefined;
  }
}

/**
 * `mappedOwner` er sat, hvis denne kalender er tildelt et familiemedlem
 * (Audit-uafhængig, se ADR-014) — kalenderen viser da medlemmets navn og
 * farve i stedet for Googles egne, så den ser ud og opfører sig som en af
 * appens egne familiekalendre. Selve tildelingen slås op af kalderen
 * (GoogleCalendarProvider), ikke her — så denne funktion forbliver ren.
 */
export function mapGoogleCalendarSource(
  entry: GoogleCalendarListEntry,
  mappedOwner?: CalendarOwner,
): CalendarSource | null {
  if (!entry.id || !entry.summary) return null;
  return { id: encodeGoogleCalendarSourceId(entry.id), name: mappedOwner?.name ?? entry.summary, providerType: "google", color: mappedOwner?.color ?? (/^#[0-9a-f]{6}$/i.test(entry.backgroundColor ?? "") ? entry.backgroundColor! : fallbackColor), isVisible: true, isReadOnly: !isGoogleCalendarWritable(entry.accessRole), externalReference: entry.id };
}

export function mapGoogleCalendarEvent(
  calendarId: string,
  event: GoogleCalendarEvent,
  mappedOwnerId?: CalendarOwnerId,
  members?: readonly CalendarOwner[],
): CalendarEvent | null {
  if (!event.id || event.status === "cancelled") return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = allDay
    ? toLocalMidnightIso(event.start?.date)
    : event.start?.dateTime;
  const end = allDay
    ? toLocalMidnightIso(event.end?.date)
    : event.end?.dateTime;
  if (!start || !end) return null;
  // Deltager-match (hvem aftalen reelt er FOR) går forud for kalender-
  // tildelingen (hvilken kalender aftalen ligger på) — mere præcist, se
  // matchAttendeesToOwnerIds.ts. Falder tilbage til kalender-tildelingen,
  // når aftalen ikke har nogen deltagere, der matcher et koblet medlem.
  const attendeeOwnerIds = matchAttendeesToOwnerIds(event.attendees, members ?? []);
  const ownerIds = attendeeOwnerIds.length > 0 ? attendeeOwnerIds : mappedOwnerId ? [mappedOwnerId] : [];
  // Google leverer seriemesterens rå id på hver forekomst. Det kodes med
  // kalender-id'et, ligesom eventets eget id, så skrivevejen senere kan
  // målrette enten forekomsten eller hele serien uden at gætte kalenderen.
  const recurrenceOccurrenceStart = event.originalStartTime
    ? event.originalStartTime.date
      ? toLocalMidnightIso(event.originalStartTime.date)
      : event.originalStartTime.dateTime
    : undefined;
  return { id: encodeGoogleEventId(calendarId, event.id), source: "google", sourceId: encodeGoogleCalendarSourceId(calendarId), title: event.summary || "Google-aftale", start, end, allDay, ownerIds, description: event.description, location: event.location, recurrenceMasterId: event.recurringEventId ? encodeGoogleEventId(calendarId, event.recurringEventId) : undefined, recurrenceOccurrenceStart, privacy: event.visibility === "private" || event.visibility === "confidential" ? "busy" : undefined };
}

export function toLocalMidnightIso(dateOnly: string | undefined): string | undefined {
  if (!dateOnly) return undefined;
  return new Date(`${dateOnly}T00:00:00`).toISOString();
}
