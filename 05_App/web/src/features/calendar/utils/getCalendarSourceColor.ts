import type { CalendarSource } from "../models/calendarProvider";
import { getLocalCalendarSources } from "../data/localCalendarSources";

const fallbackColor = "#607d8b";

export function getCalendarSourceColor(
  sourceId: string | undefined,
  sources: readonly CalendarSource[] = getLocalCalendarSources(),
): string {
  return sources.find(
    (source) => source.id === sourceId,
  )?.color ?? fallbackColor;
}
