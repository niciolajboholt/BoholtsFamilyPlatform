import { CalendarProviderError } from "../calendarProviderErrors";

const sourcePrefix = "ics:";
const eventPrefix = "ics-event:";

export function encodeIcsCalendarSourceId(subscriptionId: string): string {
  return `${sourcePrefix}${encodeURIComponent(subscriptionId)}`;
}

export function decodeIcsCalendarSourceId(sourceId: string): string {
  if (!sourceId.startsWith(sourcePrefix)) {
    throw new CalendarProviderError(
      "validation",
      "Kalenderkilden er ikke et ICS-abonnement.",
    );
  }

  return decodePart(sourceId.slice(sourcePrefix.length));
}

export function encodeIcsEventId(subscriptionId: string, eventId: string): string {
  return `${eventPrefix}${encodeURIComponent(subscriptionId)}:${encodeURIComponent(eventId)}`;
}

function decodePart(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded) throw new Error("empty");
    return decoded;
  } catch (error: unknown) {
    throw new CalendarProviderError(
      "validation",
      "ICS-kalender-ID er ugyldigt.",
      { cause: error },
    );
  }
}
