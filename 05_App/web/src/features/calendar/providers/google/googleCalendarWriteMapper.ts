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

  // Google kræver ikke formelt "timeZone" ved siden af "dateTime" (selve
  // tidsstemplet har jo allerede et UTC-offset via toISOString()), men
  // afviser i praksis nogle skriv-forespørgsler uden det — bl.a. set ved
  // skift fra heldags til tidsbestemt på et familiemedlems egen kalender
  // ("Invalid start time."). Googles egne eksempler i deres dokumentation
  // sætter altid feltet, og Outlook-mapperen (outlookCalendarWriteMapper.ts)
  // gjorde det allerede — kun Google-mapperen manglede det.
  const request: GoogleCalendarEventRequest = {
    summary: event.title.trim(),
    start: event.allDay
      ? { date: toCalendarDate(start) }
      : { dateTime: start.toISOString(), timeZone: "Europe/Copenhagen" },
    end: event.allDay
      ? { date: toCalendarDate(end) }
      : { dateTime: end.toISOString(), timeZone: "Europe/Copenhagen" },
  };

  if (event.description) request.description = event.description;
  if (event.location) request.location = event.location;

  return request;
}

export function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
