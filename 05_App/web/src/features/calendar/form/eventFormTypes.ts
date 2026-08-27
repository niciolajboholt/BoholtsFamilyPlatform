import type { CalendarOwnerId } from "../models/calendarEvent";

export interface EventFormState {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  description: string;
  location: string;
  privacy: "details" | "busy";
}
