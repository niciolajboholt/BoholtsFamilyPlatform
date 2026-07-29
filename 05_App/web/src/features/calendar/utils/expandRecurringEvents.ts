import type {
  CalendarEvent,
  RecurrenceFrequency,
  RecurrenceRule,
} from "../models/calendarEvent";
import type { CalendarEventRange } from "../models/calendarProvider";
import type { RecurrenceException } from "../preferences/recurrenceExceptionsStorage";

// Sikkerhedsgrænse mod uendelige løkker — langt mere end nogen realistisk
// gentagelse inden for et synligt kalenderinterval (uge/måned).
const MAX_OCCURRENCES = 730;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function buildExceptionKey(
  masterEventId: string,
  occurrenceStart: string,
): string {
  return `${masterEventId}::${occurrenceStart}`;
}

// Rykker startdatoen frem til den N'te forekomst, i lokal kalendertid (ikke
// millisekund-aritmetik) — undgår sommertids-forskydning, samme princip som
// getStartOfDay/getStartOfNextDay i getEventsForDate.ts.
function advanceOccurrenceDate(
  originalStart: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  occurrenceIndex: number,
): Date {
  const year = originalStart.getFullYear();
  const month = originalStart.getMonth();
  const day = originalStart.getDate();
  const steps = interval * occurrenceIndex;

  switch (frequency) {
    case "daily":
      return new Date(year, month, day + steps);
    case "weekly":
      return new Date(year, month, day + steps * 7);
    case "monthly":
      return new Date(year, month + steps, day);
    case "yearly":
      return new Date(year + steps, month, day);
    default:
      return new Date(year, month, day);
  }
}

function expandSingleEvent(
  event: CalendarEvent,
  recurrence: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
  exceptionsByKey: Map<string, RecurrenceException>,
): CalendarEvent[] {
  const originalStart = new Date(event.start);
  const originalEnd = new Date(event.end);

  if (
    Number.isNaN(originalStart.getTime()) ||
    Number.isNaN(originalEnd.getTime())
  ) {
    return [];
  }

  const durationMs = originalEnd.getTime() - originalStart.getTime();
  const spanDays = Math.round(durationMs / MS_PER_DAY);

  // NB: `until`, hvis sat, skal være en ISO-streng med et eksplicit
  // lokalt klokkeslæt (fx via samme mønster som createAllDayDate/
  // createDateTime — "YYYY-MM-DDTHH:mm:ss", ingen "Z"), ikke en bar dato —
  // ellers parses den som UTC-midnat, hvilket er præcis den tidszone-fejl-
  // klasse, der blev rettet i Sprint 12.1.
  const untilDate =
    recurrence.endType === "until" && recurrence.until
      ? new Date(recurrence.until)
      : null;

  const occurrences: CalendarEvent[] = [];

  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    if (
      recurrence.endType === "count" &&
      recurrence.count !== undefined &&
      index >= recurrence.count
    ) {
      break;
    }

    const occurrenceAnchor = advanceOccurrenceDate(
      originalStart,
      recurrence.frequency,
      recurrence.interval,
      index,
    );

    const occurrenceStart = event.allDay
      ? occurrenceAnchor
      : new Date(
          occurrenceAnchor.getFullYear(),
          occurrenceAnchor.getMonth(),
          occurrenceAnchor.getDate(),
          originalStart.getHours(),
          originalStart.getMinutes(),
          originalStart.getSeconds(),
          originalStart.getMilliseconds(),
        );

    if (untilDate && occurrenceStart > untilDate) {
      break;
    }

    // occurrenceStart stiger monotont med index for alle fire frekvenser,
    // så det er sikkert at stoppe helt (break), ikke kun springe over
    // (continue), når den første forekomst efter rangeEnd er nået.
    if (occurrenceStart > rangeEnd) {
      break;
    }

    const occurrenceEnd = event.allDay
      ? new Date(
          occurrenceAnchor.getFullYear(),
          occurrenceAnchor.getMonth(),
          occurrenceAnchor.getDate() + spanDays,
        )
      : new Date(occurrenceStart.getTime() + durationMs);

    if (occurrenceEnd < rangeStart) {
      continue;
    }

    const occurrenceStartIso = occurrenceStart.toISOString();
    const exception = exceptionsByKey.get(
      buildExceptionKey(event.id, occurrenceStartIso),
    );

    if (exception?.type === "cancelled") {
      continue;
    }

    const occurrenceEvent: CalendarEvent = {
      ...event,
      id: `${event.id}::${occurrenceStartIso}`,
      start: occurrenceStartIso,
      end: occurrenceEnd.toISOString(),
      recurrence: undefined,
      recurrenceMasterId: event.id,
      recurrenceOccurrenceStart: occurrenceStartIso,
      ...(exception?.type === "modified" ? exception.override : undefined),
    };

    occurrences.push(occurrenceEvent);
  }

  return occurrences;
}

/**
 * Udfolder mester-aftaler med en `recurrence`-regel til konkrete forekomster
 * inden for `range`. Aftaler uden `recurrence` returneres uændret. Kun
 * lokale aftaler (source: "internal") kan have `recurrence` sat — Google
 * har allerede udfoldet sine egne gentagelser, før de når hertil.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  range: CalendarEventRange,
  exceptions: readonly RecurrenceException[],
): CalendarEvent[] {
  const rangeStart = new Date(range.start);
  const rangeEnd = new Date(range.end);

  const exceptionsByKey = new Map<string, RecurrenceException>(
    exceptions.map((exception) => [
      buildExceptionKey(exception.masterEventId, exception.occurrenceStart),
      exception,
    ]),
  );

  return events.flatMap((event) => {
    if (!event.recurrence) {
      return [event];
    }

    return expandSingleEvent(
      event,
      event.recurrence,
      rangeStart,
      rangeEnd,
      exceptionsByKey,
    );
  });
}
