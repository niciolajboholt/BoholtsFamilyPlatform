import type { CalendarEvent } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { OutlookCalendarEventRequest } from "./outlookCalendarTypes";

type WritableEvent = Pick<
  CalendarEvent,
  "title" | "start" | "end" | "allDay" | "description" | "location" | "privacy"
>;

export function mapOutlookEventWriteRequest(
  event: CreateCalendarEventInput | WritableEvent,
): OutlookCalendarEventRequest {
  if (!event.title.trim()) {
    throw new CalendarProviderError("validation", "Skriv en titel til aftalen.");
  }

  const start = new Date(event.start);
  const end = new Date(event.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new CalendarProviderError("validation", "Aftalens datoer er ugyldige.");
  }
  if (end.getTime() <= start.getTime()) {
    throw new CalendarProviderError("validation", "Sluttidspunktet skal ligge efter starttidspunktet.");
  }

  const request: OutlookCalendarEventRequest = {
    subject: event.title.trim(),
    sensitivity: event.privacy === "busy" ? "private" : "normal",
    isAllDay: event.allDay,
    start: event.allDay
      ? { dateTime: toAllDayDateTime(start), timeZone: "UTC" }
      : { dateTime: toUtcDateTime(start), timeZone: "UTC" },
    end: event.allDay
      ? { dateTime: toAllDayDateTime(end), timeZone: "UTC" }
      : { dateTime: toUtcDateTime(end), timeZone: "UTC" },
  };

  if (event.description) request.body = { contentType: "text", content: event.description };
  if (event.location) request.location = { displayName: event.location };

  return request;
}

// Graph forventer dateTime uden "Z"-suffiks, når timeZone allerede er sat
// eksplicit til "UTC" ved siden af.
function toUtcDateTime(date: Date): string {
  return date.toISOString().replace("Z", "");
}

function toAllDayDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00.0000000`;
}
