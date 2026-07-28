import type { CalendarEvent } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type { GoogleCalendarListEntry, GoogleCalendarEvent } from "./googleCalendarTypes";

const fallbackColor = "#607d8b";

function googleSourceId(calendarId: string): string {
  return `google:${encodeURIComponent(calendarId)}`;
}

export function mapGoogleCalendarSource(entry: GoogleCalendarListEntry): CalendarSource | null {
  if (!entry.id) return null;
  return { id: googleSourceId(entry.id), name: entry.summary || "Google Kalender", providerType: "google", color: /^#[0-9a-f]{6}$/i.test(entry.backgroundColor ?? "") ? entry.backgroundColor! : fallbackColor, isVisible: true, isReadOnly: true, externalReference: entry.id };
}

export function mapGoogleCalendarEvent(calendarId: string, event: GoogleCalendarEvent): CalendarEvent | null {
  if (!event.id || event.status === "cancelled") return null;
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;
  if (!start || !end) return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  return { id: `google-event:${encodeURIComponent(calendarId)}:${encodeURIComponent(event.id)}`, source: "google", sourceId: googleSourceId(calendarId), title: event.summary || "Google-aftale", start, end, allDay, ownerIds: [], description: event.description, location: event.location };
}
