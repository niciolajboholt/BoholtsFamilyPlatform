import type { CalendarEvent } from "../models/calendarEvent";

const STORAGE_KEY_PREFIX = "boholts-family-google-sync-cache:";

/**
 * Sprint 25: rent lokal, forkastelig cache af sidste kendte events + Googles
 * "nextSyncToken" pr. Google-kalender-id — nødvendig for at kunne anvende en
 * inkrementel synk (som kun returnerer ÆNDRINGER siden sidst) på noget. Dette
 * er IKKE en genindførelse af det aftale-lag Sprint 20 Fase 5 fjernede
 * (ADR-011/012): cachen kan til enhver tid ryddes og genopbygges fra en fuld
 * synk uden datatab, fordi Google Calendar forbliver eneste sandhedskilde.
 */
export interface GoogleCalendarSyncCacheState {
  events: CalendarEvent[];
  syncToken: string;
}

function storageKey(calendarId: string): string {
  return `${STORAGE_KEY_PREFIX}${calendarId}`;
}

export function getCachedCalendarSyncState(
  calendarId: string,
): GoogleCalendarSyncCacheState | undefined {
  try {
    const value = window.localStorage.getItem(storageKey(calendarId));
    if (!value) return undefined;

    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as GoogleCalendarSyncCacheState).events) ||
      typeof (parsed as GoogleCalendarSyncCacheState).syncToken !== "string"
    ) {
      return undefined;
    }

    return parsed as GoogleCalendarSyncCacheState;
  } catch {
    return undefined;
  }
}

export function setCachedCalendarSyncState(
  calendarId: string,
  state: GoogleCalendarSyncCacheState,
): void {
  window.localStorage.setItem(storageKey(calendarId), JSON.stringify(state));
}

/**
 * Ryddes når et syncToken viser sig ugyldigt (410 Gone) eller ikke
 * eksisterer endnu — den efterfølgende fulde synk genopbygger cachen fra
 * bunden.
 */
export function clearCachedCalendarSyncState(calendarId: string): void {
  window.localStorage.removeItem(storageKey(calendarId));
}
