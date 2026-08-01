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

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Grupperer aftaler pr. kalenderdag (nøgle "YYYY-MM-DD"), til brug i
 * familie-planlæggerens rullende dagsrækker. Beregnes én gang pr.
 * events-ændring i stedet for pr. celle (jf. getEventsForDate, som ellers
 * ville blive kaldt gentagne gange pr. medlem × dag i det rullende vindue) —
 * en flerdags-/heldagsaftale optræder i hver dags array, den overlapper,
 * samme overlap-regel som getEventsForDate.
 */
export function groupEventsByDay(
  events: readonly CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const eventsByDay = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    if (
      Number.isNaN(eventStart.getTime()) ||
      Number.isNaN(eventEnd.getTime())
    ) {
      continue;
    }

    let cursor = getStartOfDay(eventStart);
    const lastDay = getStartOfDay(
      new Date(eventEnd.getTime() - 1),
    );

    while (cursor <= lastDay) {
      const key = toDayKey(cursor);
      const existing = eventsByDay.get(key);

      if (existing) {
        existing.push(event);
      } else {
        eventsByDay.set(key, [event]);
      }

      cursor = getStartOfNextDay(cursor);
    }
  }

  return eventsByDay;
}

export function getDayKey(date: Date): string {
  return toDayKey(date);
}
