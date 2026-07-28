import type { CalendarSource } from "../models/calendarProvider";

const STORAGE_KEY = "boholts-family-calendar-source-visibility";

function readHiddenIds(): string[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function getVisibleCalendarSourceIds(
  sources: CalendarSource[],
): string[] {
  const sourceIds = new Set(sources.map((source) => source.id));
  const hiddenIds = new Set(readHiddenIds());

  return [...sourceIds].filter((id) => !hiddenIds.has(id));
}

export function saveVisibleCalendarSourceIds(
  sources: CalendarSource[],
  visibleIds: string[],
): void {
  const visibleIdSet = new Set(visibleIds);
  const hiddenIds = sources
    .map((source) => source.id)
    .filter((id) => !visibleIdSet.has(id));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenIds));
}
