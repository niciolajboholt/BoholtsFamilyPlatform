import type { CalendarEvent } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { GoogleCalendarEventRequest } from "./googleCalendarTypes";

type WritableEvent = Pick<
  CalendarEvent,
  "title" | "start" | "end" | "allDay" | "description" | "location"
>;

export function mapGoogleEventWriteRequest(
  event: CreateCalendarEventInput | WritableEvent,
): GoogleCalendarEventRequest {
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

  const request: GoogleCalendarEventRequest = {
    summary: event.title.trim(),
    start: event.allDay
      ? { date: toCalendarDate(event.start) }
      : { dateTime: start.toISOString() },
    end: event.allDay
      ? { date: toCalendarDate(event.end) }
      : { dateTime: end.toISOString() },
  };

  if (event.description) request.description = event.description;
  if (event.location) request.location = event.location;

  return request;
}

function toCalendarDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (!match) {
    throw new CalendarProviderError("validation", "Heldagsaftalens dato er ugyldig.");
  }
  return match[1];
}
