import type { CalendarEvent } from "../models/calendarEvent";

function getStartOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

function getStartOfNextDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    0,
  );
}

function eventOccursOnDate(
  event: CalendarEvent,
  date: Date,
): boolean {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  if (
    Number.isNaN(eventStart.getTime()) ||
    Number.isNaN(eventEnd.getTime())
  ) {
    return false;
  }

  const dayStart = getStartOfDay(date);
  const nextDayStart = getStartOfNextDay(date);

  return (
    eventStart < nextDayStart &&
    eventEnd > dayStart
  );
}

function compareEvents(
  firstEvent: CalendarEvent,
  secondEvent: CalendarEvent,
): number {
  if (
    firstEvent.allDay !== secondEvent.allDay
  ) {
    return firstEvent.allDay ? -1 : 1;
  }

  const startDifference =
    new Date(firstEvent.start).getTime() -
    new Date(secondEvent.start).getTime();

  if (startDifference !== 0) {
    return startDifference;
  }

  return firstEvent.title.localeCompare(
    secondEvent.title,
    "da-DK",
  );
}

export function getEventsForDate(
  events: CalendarEvent[],
  date: Date,
): CalendarEvent[] {
  return events
    .filter((event) =>
      eventOccursOnDate(event, date),
    )
    .sort(compareEvents);
}