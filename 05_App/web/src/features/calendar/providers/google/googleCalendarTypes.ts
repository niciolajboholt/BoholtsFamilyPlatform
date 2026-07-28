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
}

export interface GoogleCalendarEventRequest {
  summary: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
}

export interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}
