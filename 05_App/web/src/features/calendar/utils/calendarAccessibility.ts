import type { CalendarEvent } from "../models/calendarEvent";

export function formatCalendarDate(
  date: Date,
): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export function getDayActionLabel(
  date: Date,
): string {
  return `Vælg dag og opret aftale den ${formatCalendarDate(date)}`;
}

export function getEventActionLabel(
  event: CalendarEvent,
): string {
  if (event.allDay) {
    return `Rediger aftale: ${event.title}, hele dagen`;
  }

  const time = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));

  return `Rediger aftale: ${event.title}, ${time}`;
}
