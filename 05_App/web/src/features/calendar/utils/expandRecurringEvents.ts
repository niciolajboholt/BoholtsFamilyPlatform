import type {
  CalendarEvent,
  CalendarWeekday,
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
// getStartOfDay/getStartOfNextDay i getEventsForDate.ts. Bruges til alle
// frekvenser undtagen ugentlig med flere valgte ugedage (se
// generateCandidateAnchors).
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

// JavaScripts søndag-først-nummerering (0=søn..6=lør) konverteret til et
// mandag-først offset (0=man..6=søn), til at placere en ugedag inden for en
// mandags-forankret uge.
function toMondayFirstOffset(weekday: CalendarWeekday): number {
  return weekday === 0 ? 6 : weekday - 1;
}

// Finder den N'te forekomst af en ugedag i en given måned (fx "3. mandag"),
// eller den sidste forekomst (ordinal -1, fx "sidste fredag"). year/month
// tillader overløb (fx month=13) — Date-konstruktøren normaliserer det
// automatisk til det korrekte år.
function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: CalendarWeekday,
  ordinal: number,
): Date {
  if (ordinal === -1) {
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const offsetFromLastDay =
      (lastDayOfMonth.getDay() - weekday + 7) % 7;

    return new Date(
      lastDayOfMonth.getFullYear(),
      lastDayOfMonth.getMonth(),
      lastDayOfMonth.getDate() - offsetFromLastDay,
    );
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const offsetFromFirstDay =
    (weekday - firstDayOfMonth.getDay() + 7) % 7;

  return new Date(
    firstDayOfMonth.getFullYear(),
    firstDayOfMonth.getMonth(),
    1 + offsetFromFirstDay + (ordinal - 1) * 7,
  );
}

// Genererer kandidat-forekomstdatoer i kronologisk rækkefølge, i lokal
// kalendertid. For ugentlig gentagelse med valgte ugedage (byWeekdays)
// udfoldes HVER valgt ugedag inden for hver inkluderet uge (fx "hver
// tirsdag og torsdag") — ikke kun aftalens egen ugedag. Uger uden for
// intervallet ("hver anden uge") springes over via weekIndex * interval.
function* generateCandidateAnchors(
  originalStart: Date,
  recurrence: RecurrenceRule,
): Generator<Date, void, undefined> {
  const { frequency, interval } = recurrence;

  if (
    frequency === "weekly" &&
    recurrence.byWeekdays &&
    recurrence.byWeekdays.length > 0
  ) {
    const weekdays = [...recurrence.byWeekdays].sort((a, b) => a - b);

    const startOfDay = new Date(
      originalStart.getFullYear(),
      originalStart.getMonth(),
      originalStart.getDate(),
    );

    const anchorWeekMonday = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      startOfDay.getDate() - toMondayFirstOffset(originalStart.getDay() as CalendarWeekday),
    );

    for (let weekIndex = 0; ; weekIndex += 1) {
      const weekMonday = new Date(
        anchorWeekMonday.getFullYear(),
        anchorWeekMonday.getMonth(),
        anchorWeekMonday.getDate() + weekIndex * interval * 7,
      );

      for (const weekday of weekdays) {
        const candidate = new Date(
          weekMonday.getFullYear(),
          weekMonday.getMonth(),
          weekMonday.getDate() + toMondayFirstOffset(weekday),
        );

        // Ugedage tidligere i mester-aftalens egen uge, end selve
        // startdatoen, tæller ikke som en forekomst (serien er ikke
        // begyndt endnu) — først fra og med startdatoen.
        if (candidate.getTime() >= startOfDay.getTime()) {
          yield candidate;
        }
      }
    }
  } else if (
    frequency === "monthly" &&
    recurrence.monthlyPattern === "dayOfWeek" &&
    recurrence.byOrdinalWeekday
  ) {
    const { ordinals, weekday } = recurrence.byOrdinalWeekday;

    // Sorteres kronologisk inden for måneden (fx [1, -1] = "første og
    // sidste fredag") — positive ordinaler i rækkefølge, "sidste" (-1)
    // altid til sidst, da den pr. definition falder efter enhver positiv
    // position i samme måned.
    const sortedOrdinals = [...ordinals].sort(
      (first, second) =>
        (first === -1 ? Number.MAX_SAFE_INTEGER : first) -
        (second === -1 ? Number.MAX_SAFE_INTEGER : second),
    );

    for (let index = 0; ; index += 1) {
      const month = originalStart.getMonth() + interval * index;
      let previousCandidateTime: number | null = null;

      for (const ordinal of sortedOrdinals) {
        const candidate = getNthWeekdayOfMonth(
          originalStart.getFullYear(),
          month,
          weekday,
          ordinal,
        );

        // Forsvar mod en teoretisk dublet (fx "4." og "sidste" rammer
        // samme dato i en måned med præcis 4 forekomster af ugedagen).
        if (candidate.getTime() === previousCandidateTime) {
          continue;
        }

        previousCandidateTime = candidate.getTime();
        yield candidate;
      }
    }
  } else {
    for (let index = 0; ; index += 1) {
      yield advanceOccurrenceDate(originalStart, frequency, interval, index);
    }
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
  let anchorNumber = 0;

  for (const occurrenceAnchor of generateCandidateAnchors(
    originalStart,
    recurrence,
  )) {
    anchorNumber += 1;

    // Sikkerhedsgrænse mod uendelige løkker — tæller alle betragtede
    // kandidater, ikke kun de accepterede, så en tom/ugyldig regel aldrig
    // kan hænge.
    if (anchorNumber > MAX_OCCURRENCES) {
      break;
    }

    // `count` refererer til forekomstens globale rækkefølge i serien
    // (1., 2., 3. ...), uafhængigt af hvilket synligt datointerval der
    // aktuelt vises — derfor tælles anchorNumber, ikke antallet af
    // forekomster der rent faktisk falder inden for range.
    if (
      recurrence.endType === "count" &&
      recurrence.count !== undefined &&
      anchorNumber > recurrence.count
    ) {
      break;
    }

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

    // occurrenceStart stiger monotont med anchorNumber for alle
    // understøttede mønstre, så det er sikkert at stoppe helt (break),
    // ikke kun springe over (continue), når den første forekomst efter
    // rangeEnd er nået.
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
