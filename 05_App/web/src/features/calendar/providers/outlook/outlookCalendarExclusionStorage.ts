const STORAGE_KEY = "boholts-family-outlook-excluded-calendars";

function readExcludedIds(): string[] {
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

/**
 * Rå Outlook-kalender-id'er (ikke det kodede sourceId), som brugeren aktivt
 * har fravalgt i "Vælg Outlook-kalendere"-dialogen — mirror af
 * googleCalendarExclusionStorage.ts, egen storage-nøgle pr. provider.
 */
export function getExcludedOutlookCalendarIds(): string[] {
  return readExcludedIds();
}

export function setExcludedOutlookCalendars(calendarIds: readonly string[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...new Set(calendarIds)]),
  );
}

export function clearExcludedOutlookCalendars(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
