export interface GoogleCalendarListEntry {
  id?: string;
  summary?: string;
  backgroundColor?: string;
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
}

export interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}
