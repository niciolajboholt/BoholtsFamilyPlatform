import type { CalendarOwnerId } from "../models/calendarEvent";

export interface CalendarOwner {
  id: CalendarOwnerId;
  name: string;
  color: string;
}

export const calendarOwners: Record<CalendarOwnerId, CalendarOwner> = {
  nicolaj: {
    id: "nicolaj",
    name: "Nicolaj",
    color: "#2E7D32",
  },
  christine: {
    id: "christine",
    name: "Christine",
    color: "#C06C84",
  },
  alfred: {
    id: "alfred",
    name: "Alfred",
    color: "#D99832",
  },
  jens: {
    id: "jens",
    name: "Jens",
    color: "#4D7EA8",
  },
  family: {
    id: "family",
    name: "Familien",
    color: "#6D597A",
  },
};