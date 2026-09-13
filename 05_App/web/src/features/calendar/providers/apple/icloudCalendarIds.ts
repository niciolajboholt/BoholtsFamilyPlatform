import { CalendarProviderError } from "../calendarProviderErrors";

// Sprint 47: iCloud-kalender-URL'er og hændelses-href'er er hele URL'er
// (ikke korte opaque id'er som Googles calendarId/eventId), så de kodes ind
// i sourceId/eventId på samme måde som icsCalendarIds.ts — hver del
// encodeURIComponent'et for sig og samlet med ":", så ":" trygt kan bruges
// som separator (ingen del kan indeholde et ukodet ":").
const sourcePrefix = "icloud:";
const eventPrefix = "icloud-event:";

function decodePart(value: string): string {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded) throw new Error("empty");
    return decoded;
  } catch (error: unknown) {
    throw new CalendarProviderError("validation", "iCloud-kalender-ID er ugyldigt.", { cause: error });
  }
}

export function encodeIcloudCalendarSourceId(connectionId: string, calendarUrl: string): string {
  return `${sourcePrefix}${encodeURIComponent(connectionId)}:${encodeURIComponent(calendarUrl)}`;
}

export interface DecodedIcloudCalendarSourceId {
  connectionId: string;
  calendarUrl: string;
}

export function decodeIcloudCalendarSourceId(sourceId: string): DecodedIcloudCalendarSourceId {
  if (!sourceId.startsWith(sourcePrefix)) {
    throw new CalendarProviderError("validation", "Kalenderkilden er ikke en iCloud-kalender.");
  }

  const [connectionId, calendarUrl] = sourceId.slice(sourcePrefix.length).split(":");
  if (!connectionId || !calendarUrl) {
    throw new CalendarProviderError("validation", "iCloud-kalender-ID er ugyldigt.");
  }

  return { connectionId: decodePart(connectionId), calendarUrl: decodePart(calendarUrl) };
}

// etag kan være null (fx en hændelse, iCloud ikke returnerede et etag for) —
// kodes som en tom streng-del i stedet for at udelade delen, så
// positionerne i split(":") altid er faste.
export function encodeIcloudEventId(
  connectionId: string,
  calendarUrl: string,
  uid: string,
  href: string,
  etag: string | null,
): string {
  return [
    eventPrefix.slice(0, -1),
    encodeURIComponent(connectionId),
    encodeURIComponent(calendarUrl),
    encodeURIComponent(uid),
    encodeURIComponent(href),
    encodeURIComponent(etag ?? ""),
  ].join(":");
}

export interface DecodedIcloudEventId {
  connectionId: string;
  calendarUrl: string;
  uid: string;
  href: string;
  etag: string | null;
}

export function decodeIcloudEventId(eventId: string): DecodedIcloudEventId {
  if (!eventId.startsWith(eventPrefix)) {
    throw new CalendarProviderError("validation", "Hændelsen er ikke en iCloud-hændelse.");
  }

  const parts = eventId.slice(eventPrefix.length).split(":");
  if (parts.length !== 5) {
    throw new CalendarProviderError("validation", "iCloud-hændelses-ID er ugyldigt.");
  }

  const [connectionId, calendarUrl, uid, href, etag] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  return {
    connectionId: decodePart(connectionId),
    calendarUrl: decodePart(calendarUrl),
    uid: decodePart(uid),
    href: decodePart(href),
    etag: etag === "" ? null : decodePart(etag),
  };
}
