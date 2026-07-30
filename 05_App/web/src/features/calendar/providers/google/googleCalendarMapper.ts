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
  if (!entry.id || !entry.summary) return null;
  return { id: encodeGoogleCalendarSourceId(entry.id), name: entry.summary, providerType: "google", color: /^#[0-9a-f]{6}$/i.test(entry.backgroundColor ?? "") ? entry.backgroundColor! : fallbackColor, isVisible: true, isReadOnly: !isGoogleCalendarWritable(entry.accessRole), externalReference: entry.id };
}

export function mapGoogleCalendarEvent(calendarId: string, event: GoogleCalendarEvent): CalendarEvent | null {
  if (!event.id || event.status === "cancelled") return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = allDay
    ? toLocalMidnightIso(event.start?.date)
    : event.start?.dateTime;
  const end = allDay
    ? toLocalMidnightIso(event.end?.date)
    : event.end?.dateTime;
  if (!start || !end) return null;
  // event.recurringEventId er sat på hver enkelt forekomst af en Google-
  // gentagelse (Google udfolder selv serien pga. singleEvents: "true" i
  // GoogleCalendarApi.listEvents) — mappes til recurrenceMasterId, samme
  // felt som lokale udfoldede forekomster bruger (expandRecurringEvents).
  return { id: encodeGoogleEventId(calendarId, event.id), source: "google", sourceId: encodeGoogleCalendarSourceId(calendarId), title: event.summary || "Google-aftale", start, end, allDay, ownerIds: [], description: event.description, location: event.location, recurrenceMasterId: event.recurringEventId };
}

export function toLocalMidnightIso(dateOnly: string | undefined): string | undefined {
  if (!dateOnly) return undefined;
  return new Date(`${dateOnly}T00:00:00`).toISOString();
}
