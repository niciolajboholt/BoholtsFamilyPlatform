import type { CalendarEvent } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { GoogleCalendarEventRequest } from "./googleCalendarTypes";

type WritableEvent = Pick<
  CalendarEvent,
  "title" | "start" | "end" | "allDay" | "description" | "location" | "privacy"
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

  // PATCH's "patch semantics" betyder her, at et felt vi UDELADER (fx "date"
  // ved skift til tidsbestemt) IKKE bliver ryddet på Googles side — den
  // gamle værdi bliver siddende ved siden af den nye "dateTime", så aftalen
  // ender med BÅDE date og dateTime sat, hvilket er ugyldigt og afvises
  // (set som "Invalid start time." ved ethvert skift mellem heldags og
  // tidsbestemt, uanset kalender). Løsningen er at sætte det andet felt
  // eksplicit til null, som Google Kalender-API'et bruger til at rydde et
  // felt via PATCH.
  const request: GoogleCalendarEventRequest = {
    summary: event.title.trim(),
    visibility: event.privacy === "busy" ? "private" : "default",
    start: event.allDay
      ? { date: toCalendarDate(start), dateTime: null, timeZone: null }
      : { dateTime: start.toISOString(), timeZone: "Europe/Copenhagen", date: null },
    end: event.allDay
      ? { date: toCalendarDate(end), dateTime: null, timeZone: null }
      : { dateTime: end.toISOString(), timeZone: "Europe/Copenhagen", date: null },
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
