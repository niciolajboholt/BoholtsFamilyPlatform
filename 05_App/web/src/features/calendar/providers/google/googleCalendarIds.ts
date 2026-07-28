import { CalendarProviderError } from "../calendarProviderErrors";

const sourcePrefix = "google:";
const eventPrefix = "google-event:";

export function encodeGoogleCalendarSourceId(
  calendarId: string,
): string {
  return `${sourcePrefix}${encodeURIComponent(calendarId)}`;
}

export function decodeGoogleCalendarSourceId(
  sourceId: string,
): string {
  if (!sourceId.startsWith(sourcePrefix)) {
    throw new CalendarProviderError(
      "validation",
      "Kalenderkilden er ikke en Google-kalender.",
    );
  }

  return decodePart(sourceId.slice(sourcePrefix.length));
}

export function encodeGoogleEventId(
  calendarId: string,
  eventId: string,
): string {
  return `${eventPrefix}${encodeURIComponent(calendarId)}:${encodeURIComponent(eventId)}`;
}

export function decodeGoogleEventId(
  id: string,
): { calendarId: string; eventId: string } {
  if (!id.startsWith(eventPrefix)) {
    throw new CalendarProviderError(
      "validation",
      "Aftalen er ikke en Google-aftale.",
    );
  }

  const encodedParts = id.slice(eventPrefix.length).split(":");
  if (encodedParts.length !== 2) {
    throw new CalendarProviderError("validation", "Google-aftale-ID er ugyldigt.");
  }

  return {
    calendarId: decodePart(encodedParts[0]),
    eventId: decodePart(encodedParts[1]),
  };
}

function decodePart(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded) throw new Error("empty");
    return decoded;
  } catch (error: unknown) {
    throw new CalendarProviderError(
      "validation",
      "Google-kalender-ID er ugyldigt.",
      { cause: error },
    );
  }
}
