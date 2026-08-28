export type GoogleCalendarAccessRole =
  | "freeBusyReader"
  | "reader"
  | "writer"
  | "owner";

export interface GoogleCalendarListEntry {
  id?: string;
  summary?: string;
  backgroundColor?: string;
  accessRole?: string;
}

export interface GoogleCalendarListResponse {
  items?: GoogleCalendarListEntry[];
  nextPageToken?: string;
}

export interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleCalendarEventAttendee {
  email?: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  recurringEventId?: string;
  visibility?: string;
  // Bruges til at genkende, hvilke familiemedlemmer aftalen reelt er FOR —
  // mere præcist end kalender-tildelingen, som kun ved hvilken kalender
  // aftalen ligger på (se matchAttendeesToOwnerIds.ts). Kun til stede, hvis
  // Google-aftalen faktisk har inviterede deltagere.
  attendees?: GoogleCalendarEventAttendee[];
}

// Kun til skrivning (create/update) — "date"/"dateTime"/"timeZone" skal
// kunne sættes eksplicit til null for at rydde det MODSATTE felt ved skift
// mellem heldags og tidsbestemt (se googleCalendarWriteMapper.ts). Googles
// svar (GoogleEventDateTime ovenfor) bruger derimod aldrig null.
export interface GoogleEventDateTimeWrite {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
}

export interface GoogleCalendarEventRequest {
  summary: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTimeWrite;
  end: GoogleEventDateTimeWrite;
  visibility?: "default" | "private";
}

export interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  // Sprint 25: kun til stede på svarets sidste side (når nextPageToken er
  // fraværende) — bruges til den næste inkrementelle synk i stedet for
  // timeMin/timeMax. Se GoogleCalendarProvider.getEvents().
  nextSyncToken?: string;
}
