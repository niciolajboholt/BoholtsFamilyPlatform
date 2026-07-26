export type CalendarOwnerId =
  | "nicolaj"
  | "christine"
  | "alfred"
  | "jens"
  | "family";

export type CalendarSource =
  | "internal"
  | "google";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  source: CalendarSource;
  location?: string;
  color?: string;
}