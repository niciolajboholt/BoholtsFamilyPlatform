// Server-side spejl af klientens src/features/calendar/providers/google/
// googleCalendarIds.ts — samme kodning, så et event-id sendt fra klienten
// (fx til event-påmindelser) kan afkodes/genkodes server-side. Serveren
// importerer bevidst ikke fra src/ (adskilte builds, se
// googleCalendarAggregation.ts's samme mønster for selve event-typerne).

const eventPrefix = "google-event:";

export function encodeGoogleEventId(calendarId: string, eventId: string): string {
  return `${eventPrefix}${encodeURIComponent(calendarId)}:${encodeURIComponent(eventId)}`;
}

export function decodeGoogleEventId(
  id: string,
): { calendarId: string; eventId: string } | null {
  if (!id.startsWith(eventPrefix)) {
    return null;
  }

  const encodedParts = id.slice(eventPrefix.length).split(":");
  if (encodedParts.length !== 2) {
    return null;
  }

  try {
    const calendarId = decodeURIComponent(encodedParts[0]!);
    const eventId = decodeURIComponent(encodedParts[1]!);
    if (!calendarId || !eventId) {
      return null;
    }

    return { calendarId, eventId };
  } catch {
    return null;
  }
}
