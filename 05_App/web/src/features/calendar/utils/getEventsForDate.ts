import type { CalendarEvent } from "../models/calendarEvent";

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getEventsForDate(
  events: CalendarEvent[],
  date: Date,
): CalendarEvent[] {
  const selectedDate = getDateKey(date);

  return events
    .filter((event) => event.start.slice(0, 10) === selectedDate)
    .sort((a, b) => a.start.localeCompare(b.start));
}