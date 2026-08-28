// Fase 9: ICS' CLASS-egenskab (RFC 5545 §3.8.1.3, PUBLIC/PRIVATE/CONFIDENTIAL)
// er den direkte pendant til Googles `visibility` — samme redaktionsprincip
// som googleCalendarPrivacy.ts, men bevidst en selvstændig funktion i
// stedet for en delt/generisk en, for at holde denne første ICS-skive
// afgrænset (samme mønster som resten af kodebasens per-provider privacy-
// felter, jf. eventReminders.ts/calendar.ts's brug af isPrivateGoogleEvent).
//
// Vigtig forskel fra Google: CLASS sættes langt fra altid af gratis/
// offentlige ICS-feeds (mange kalenderværktøjer udelader det helt) — det er
// derfor kun en "bedste forsøg"-garanti, ikke en garanti på Googles niveau.
// Det skal kommunikeres i UI'et, ikke behandles som lige så pålideligt.

interface IcsPrivacyFields {
  class?: string;
  summary?: string;
  description?: string;
  location?: string;
}

export interface SafeIcsEventDetails {
  title: string;
  description?: string;
  location?: string;
  isPrivate: boolean;
}

export function isPrivateIcsEvent(
  event: Pick<IcsPrivacyFields, "class"> | null | undefined,
): boolean {
  const value = event?.class?.toUpperCase();
  return value === "PRIVATE" || value === "CONFIDENTIAL";
}

export function getSafeIcsEventDetails(event: IcsPrivacyFields): SafeIcsEventDetails {
  if (isPrivateIcsEvent(event)) {
    return {
      title: "Optaget",
      isPrivate: true,
    };
  }

  return {
    title: event.summary || "Aftale",
    description: event.description,
    location: event.location,
    isPrivate: false,
  };
}
