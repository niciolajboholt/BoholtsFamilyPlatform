import type { CalendarEvent } from "../models/calendarEvent";

const STORAGE_KEY_PREFIX = "boholts-family-google-sync-cache:";

/**
 * Sprint 25: rent lokal, forkastelig cache af sidste kendte events + Googles
 * "nextSyncToken" pr. Google-kalender-id — nødvendig for at kunne anvende en
 * inkrementel synk (som kun returnerer ÆNDRINGER siden sidst) på noget. Dette
 * er IKKE en genindførelse af det aftale-lag Sprint 20 Fase 5 fjernede
 * (ADR-011/012): cachen kan til enhver tid ryddes og genopbygges fra en fuld
 * synk uden datatab, fordi Google Calendar forbliver eneste sandhedskilde.
 *
 * Fase 8: `updatedAt` (tilføjet her) gør det muligt at afgøre, om cachen er
 * frisk nok til at vises som et offline-fallback, jf.
 * `31_Offline_Data_Policy.md`'s 7-dages-TTL.
 */
export interface GoogleCalendarSyncCacheState {
  events: CalendarEvent[];
  syncToken: string;
  updatedAt: string;
}

// Jf. 31_Offline_Data_Policy.md: data ældre end dette vises ikke som
// offline-fallback — appen viser i stedet en tom-tilstand.
export const OFFLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isCacheEntryFresh(
  updatedAt: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!updatedAt) return false;

  const updatedAtMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) return false;

  return now - updatedAtMs <= OFFLINE_CACHE_MAX_AGE_MS;
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
      typeof (parsed as GoogleCalendarSyncCacheState).syncToken !== "string" ||
      typeof (parsed as GoogleCalendarSyncCacheState).updatedAt !== "string"
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
  state: Omit<GoogleCalendarSyncCacheState, "updatedAt">,
): void {
  const fullState: GoogleCalendarSyncCacheState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey(calendarId), JSON.stringify(fullState));
}

/**
 * Ryddes når et syncToken viser sig ugyldigt (410 Gone) eller ikke
 * eksisterer endnu — den efterfølgende fulde synk genopbygger cachen fra
 * bunden.
 */
export function clearCachedCalendarSyncState(calendarId: string): void {
  window.localStorage.removeItem(storageKey(calendarId));
}

export interface GoogleCalendarSyncCacheEntry {
  calendarId: string;
  state: GoogleCalendarSyncCacheState;
}

/**
 * Fase 8: alle lokalt kendte kalender-caches på tværs af Google-kalender-id —
 * bruges til at genopbygge en offline-fallback, når selve kalenderlisten
 * ikke kan hentes fra Google (fuldt offline), ikke kun når et enkelt
 * kalenders inkrementelle synk fejler.
 */
export function listCachedCalendarSyncEntries(): GoogleCalendarSyncCacheEntry[] {
  const entries: GoogleCalendarSyncCacheEntry[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;

    const calendarId = key.slice(STORAGE_KEY_PREFIX.length);
    const state = getCachedCalendarSyncState(calendarId);

    if (state) {
      entries.push({ calendarId, state });
    }
  }

  return entries;
}
