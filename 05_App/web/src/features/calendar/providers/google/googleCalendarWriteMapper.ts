import type { CalendarEvent, CalendarWeekday, RecurrenceRule } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { GoogleCalendarEventRequest } from "./googleCalendarTypes";

type WritableEvent = Pick<
  CalendarEvent,
  "title" | "start" | "end" | "allDay" | "description" | "location" | "privacy"
>;

const weekdayToRRuleCode: Record<CalendarWeekday, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

// RFC 5545 kræver, at UNTIL's værditype matcher DTSTART's: en dato-kun
// værdi (YYYYMMDD) for en heldagsaftale, ellers en UTC-dato-tid
// (YYYYMMDDTHHMMSSZ) — aldrig en blanding af de to.
function formatRRuleUntil(untilIso: string, allDay: boolean): string {
  const date = new Date(untilIso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  if (allDay) {
    return `${year}${month}${day}`;
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Oversætter appens interne RecurrenceRule (bygget af
 * recurrenceFormValueToRule) til Googles `recurrence`-felt: en liste af
 * RFC 5545 RRULE-linjer. RecurrenceRule er allerede struktureret næsten
 * felt-for-felt som en RRULE — dette er formatering, ikke en ny model.
 * Årlig gentagelse sætter bevidst ikke BYMONTH: FREQ=YEARLY gentager i
 * forvejen på DTSTART's egen måned/dag uden det.
 */
export function mapRecurrenceRuleToGoogleRRule(rule: RecurrenceRule, allDay: boolean): string[] {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`];

  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.frequency === "weekly" && rule.byWeekdays && rule.byWeekdays.length > 0) {
    parts.push(`BYDAY=${rule.byWeekdays.map((weekday) => weekdayToRRuleCode[weekday]).join(",")}`);
  }

  if (rule.frequency === "monthly") {
    if (rule.monthlyPattern === "dayOfWeek" && rule.byOrdinalWeekday) {
      const code = weekdayToRRuleCode[rule.byOrdinalWeekday.weekday];
      parts.push(
        `BYDAY=${rule.byOrdinalWeekday.ordinals.map((ordinal) => `${ordinal}${code}`).join(",")}`,
      );
    } else if (rule.byMonthDay) {
      parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
    }
  }

  if (rule.endType === "until" && rule.until) {
    parts.push(`UNTIL=${formatRRuleUntil(rule.until, allDay)}`);
  }

  if (rule.endType === "count" && rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  return [`RRULE:${parts.join(";")}`];
}

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

  // Kun CreateCalendarEventInput har et recurrence-felt — en redigering
  // (WritableEvent) har det slet ikke, så en eksisterende aftales
  // gentagelse kan ikke utilsigtet blive rørt af denne funktion (se
  // planens beslutning 4).
  if ("recurrence" in event && event.recurrence) {
    request.recurrence = mapRecurrenceRuleToGoogleRRule(event.recurrence, event.allDay);
  }

  return request;
}

export function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
