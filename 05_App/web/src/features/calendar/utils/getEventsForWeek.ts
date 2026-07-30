import type { CalendarEvent } from "../models/calendarEvent";

function getStartOfWeek(date: Date): Date {
  const startOfWeek = new Date(date);
  const dayOfWeek = startOfWeek.getDay();

  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  return startOfWeek;
}

function getEndOfWeek(date: Date): Date {
  const endOfWeek = getStartOfWeek(date);

  endOfWeek.setDate(endOfWeek.getDate() + 7);

  return endOfWeek;
}

export function getEventsForWeek(
  events: CalendarEvent[],
  date: Date,
): CalendarEvent[] {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = getEndOfWeek(date);

  return events
    .filter((event) => {
      const eventStart = new Date(event.start);

      return eventStart >= startOfWeek && eventStart < endOfWeek;
    })
    .sort(
      (firstEvent, secondEvent) =>
        new Date(firstEvent.start).getTime() -
        new Date(secondEvent.start).getTime(),
    );
}