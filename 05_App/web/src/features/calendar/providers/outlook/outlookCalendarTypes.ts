export interface OutlookCalendarListEntry {
  id?: string;
  name?: string;
  canEdit?: boolean;
}

export interface OutlookCalendarListResponse {
  value?: OutlookCalendarListEntry[];
  "@odata.nextLink"?: string;
}

export interface OutlookEventDateTime {
  dateTime?: string;
  timeZone?: string;
}

export interface OutlookCalendarEvent {
  id?: string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName?: string };
  isAllDay?: boolean;
  isCancelled?: boolean;
  start?: OutlookEventDateTime;
  end?: OutlookEventDateTime;
  seriesMasterId?: string;
  sensitivity?: string;
}

export interface OutlookCalendarEventsResponse {
  value?: OutlookCalendarEvent[];
  "@odata.nextLink"?: string;
}

export interface OutlookCalendarEventRequest {
  subject: string;
  body?: { contentType: "text"; content: string };
  location?: { displayName: string };
  isAllDay?: boolean;
  start: OutlookEventDateTime;
  end: OutlookEventDateTime;
}
