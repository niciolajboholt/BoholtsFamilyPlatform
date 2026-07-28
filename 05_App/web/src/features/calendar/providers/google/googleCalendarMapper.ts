import type { CalendarEvent } from "../../models/calendarEvent";
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

export function mapGoogleCalendarSource(entry: GoogleCalendarListEntry): CalendarSource | null {
  if (!entry.id) return null;
  return { id: encodeGoogleCalendarSourceId(entry.id), name: entry.summary || "Google Kalender", providerType: "google", color: /^#[0-9a-f]{6}$/i.test(entry.backgroundColor ?? "") ? entry.backgroundColor! : fallbackColor, isVisible: true, isReadOnly: !isGoogleCalendarWritable(entry.accessRole), externalReference: entry.id };
}

export function mapGoogleCalendarEvent(calendarId: string, event: GoogleCalendarEvent): CalendarEvent | null {
  if (!event.id || event.status === "cancelled" || event.recurringEventId) return null;
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  return { id: encodeGoogleEventId(calendarId, event.id), source: "google", sourceId: encodeGoogleCalendarSourceId(calendarId), title: event.summary || "Google-aftale", start, end, allDay, ownerIds: [], description: event.description, location: event.location };
}
