import type {
  CalendarOwnerId,
  RecurrenceRule,
} from "./calendarEvent";

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  description?: string;
  location?: string;
  recurrence?: RecurrenceRule;
}
