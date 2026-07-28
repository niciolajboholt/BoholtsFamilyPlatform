import { localCalendarSources } from "../data/localCalendarSources";

const fallbackColor = "#607d8b";

export function getCalendarSourceColor(
  sourceId: string | undefined,
): string {
  return localCalendarSources.find(
    (source) => source.id === sourceId,
  )?.color ?? fallbackColor;
}
