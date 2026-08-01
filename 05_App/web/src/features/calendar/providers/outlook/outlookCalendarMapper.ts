import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type {
  OutlookCalendarEvent,
  OutlookCalendarListEntry,
} from "./outlookCalendarTypes";
import {
  encodeOutlookCalendarSourceId,
  encodeOutlookEventId,
} from "./outlookCalendarIds";

// Microsoft Graph's calendar "color" field is a named enum (fx "lightBlue"),
// ikke en hex-værdi som Googles backgroundColor — der er derfor ingen
// meningsfuld hex at udlede herfra, i modsætning til Google-mapperen.
const fallbackColor = "#5C2D91";

/**
 * `mappedOwner` er sat, hvis denne kalender er tildelt et familiemedlem
 * (ADR-014) — samme mønster som googleCalendarMapper.ts. Selve tildelingen
 * slås op af kalderen (OutlookCalendarProvider), ikke her.
 */
export function mapOutlookCalendarSource(
  entry: OutlookCalendarListEntry,
  mappedOwner?: CalendarOwner,
): CalendarSource | null {
  if (!entry.id || !entry.name) return null;

  return {
    id: encodeOutlookCalendarSourceId(entry.id),
    name: mappedOwner?.name ?? entry.name,
    providerType: "outlook",
    color: mappedOwner?.color ?? fallbackColor,
    isVisible: true,
    isReadOnly: !entry.canEdit,
    externalReference: entry.id,
  };
}

export function mapOutlookCalendarEvent(
  calendarId: string,
  event: OutlookCalendarEvent,
  mappedOwnerId?: CalendarOwnerId,
): CalendarEvent | null {
  if (!event.id || event.isCancelled) return null;

  const allDay = Boolean(event.isAllDay);
  const start = allDay
    ? toLocalMidnightIso(event.start?.dateTime)
    : toUtcIso(event.start?.dateTime);
  const end = allDay
    ? toLocalMidnightIso(event.end?.dateTime)
    : toUtcIso(event.end?.dateTime);

  if (!start || !end) return null;

  // event.seriesMasterId er Graphs modstykke til Googles recurringEventId —
  // sat på hver forekomst, der kommer fra /calendarView (som selv udfolder
  // gentagne serier). Mappes til det samme recurrenceMasterId-felt.
  return {
    id: encodeOutlookEventId(calendarId, event.id),
    source: "outlook",
    sourceId: encodeOutlookCalendarSourceId(calendarId),
    title: event.subject || "Outlook-aftale",
    start,
    end,
    allDay,
    ownerIds: mappedOwnerId ? [mappedOwnerId] : [],
    description: event.bodyPreview,
    location: event.location?.displayName,
    recurrenceMasterId: event.seriesMasterId,
  };
}

// Graph-kald beder altid om Prefer: outlook.timezone="UTC" (se
// OutlookCalendarApi), så dateTime-strenge mangler kun det afsluttende "Z"
// for at være et gyldigt ISO-tidspunkt.
function toUtcIso(dateTime: string | undefined): string | undefined {
  if (!dateTime) return undefined;
  return dateTime.endsWith("Z") ? dateTime : `${dateTime}Z`;
}

export function toLocalMidnightIso(dateTime: string | undefined): string | undefined {
  if (!dateTime) return undefined;
  const dateOnly = dateTime.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00`).toISOString();
}
