import type { CalendarEventRange } from "../models/calendarProvider";
import type { CalendarView } from "../models/calendarView";

export function getTodayCalendarDate(): Date {
  const today = new Date();

  today.setHours(12, 0, 0, 0);

  return today;
}

export function startOfMonth(
  date: Date,
): Date {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

export function changeMonth(
  date: Date,
  numberOfMonths: number,
): Date {
  const result = new Date(
    date.getFullYear(),
    date.getMonth() +
      numberOfMonths,
    1,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

export function changeWeek(
  date: Date,
  numberOfWeeks: number,
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() +
      numberOfWeeks * 7,
  );

  result.setHours(12, 0, 0, 0);

  return result;
}

export function changeDay(
  date: Date,
  numberOfDays: number,
): Date {
  const result = new Date(date);

  result.setDate(result.getDate() + numberOfDays);
  result.setHours(12, 0, 0, 0);

  return result;
}

// Rundhåndet interval omkring det synlige tidsrum (uge- eller måneds-gitter
// kan række ~1 uge ind i nabomåneder) — bruges kun til at afgrænse
// gentagelses-udfoldning, ikke til præcis dag-visning (det gør
// getEventsForDate/getEventsForWeek stadig nedstrøms). Planlæggeren udregner
// sit eget, dynamisk voksende interval internt (se FamilyPlannerCalendar) og
// bruger ikke denne værdi — falder derfor blot igennem til månedens brede
// standardbuffer nedenfor.
export function getVisibleRange(
  visibleDate: Date,
  calendarView: CalendarView,
): CalendarEventRange {
  if (calendarView === "week") {
    const start = new Date(visibleDate);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(visibleDate);
    end.setDate(end.getDate() + 14);
    end.setHours(0, 0, 0, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  if (calendarView === "day") {
    const start = new Date(visibleDate);
    start.setDate(start.getDate() - 3);
    start.setHours(0, 0, 0, 0);

    const end = new Date(visibleDate);
    end.setDate(end.getDate() + 4);
    end.setHours(0, 0, 0, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  const start = new Date(
    visibleDate.getFullYear(),
    visibleDate.getMonth(),
    1,
  );
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(
    visibleDate.getFullYear(),
    visibleDate.getMonth() + 1,
    1,
  );
  end.setDate(end.getDate() + 7);
  end.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Månedsvisningen er svær at læse på en telefon (aftalekortene skal være
// meget små for at være der) — mobil starter derfor i ugevisning, mens
// større skærme fortsat starter i månedsvisning.
export function getDefaultCalendarView(): CalendarView {
  if (typeof window === "undefined") {
    return "month";
  }

  return window.innerWidth < 600 ? "week" : "month";
}
