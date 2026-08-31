import type { CalendarEvent } from "../models/calendarEvent";

const STORAGE_KEY_PREFIX = "boholts-family-ics-sync-cache:";

/**
 * Fase 9: lokal cache af senest hentede aftaler pr. ICS-abonnement — uden
 * Googles syncToken-halvdel (googleCalendarSyncCacheStorage.ts), da et
 * ICS-link ikke har nogen delta-synk-API.
 *
 * I modsætning til Google-cachen er denne HER den primære friskheds-
 * strategi, ikke kun et offline-fallback: IcsCalendarProvider springer selve
 * netværkshentningen over, så længe en post er inden for
 * ICS_REFRESH_TTL_MS, for ikke at hamre eksterne, ofte langsomme
 * ICS-servere ved hver eneste kalendervisning. `ICS_OFFLINE_CACHE_MAX_AGE_MS`
 * afgør, hvor længe en post derudover stadig må bruges som fallback, hvis en
 * frisk hentning fejler — samme 7-dages-grænse som Google, jf.
 * 31_Offline_Data_Policy.md.
 */
export interface IcsCalendarSyncCacheState {
  events: CalendarEvent[];
  updatedAt: string;
}

export const ICS_REFRESH_TTL_MS = 15 * 60 * 1000;

export const ICS_OFFLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isIcsCacheEntryFresh(
  updatedAt: string | undefined,
  maxAgeMs: number,
  now: number = Date.now(),
): boolean {
  if (!updatedAt) return false;

  const updatedAtMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedAtMs)) return false;

  return now - updatedAtMs <= maxAgeMs;
}

function storageKey(subscriptionId: string): string {
  return `${STORAGE_KEY_PREFIX}${subscriptionId}`;
}

export function getCachedIcsEvents(
  subscriptionId: string,
): IcsCalendarSyncCacheState | undefined {
  try {
    const value = window.localStorage.getItem(storageKey(subscriptionId));
    if (!value) return undefined;

    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as IcsCalendarSyncCacheState).events) ||
      typeof (parsed as IcsCalendarSyncCacheState).updatedAt !== "string"
    ) {
      return undefined;
    }

    return parsed as IcsCalendarSyncCacheState;
  } catch {
    return undefined;
  }
}

export function setCachedIcsEvents(
  subscriptionId: string,
  events: CalendarEvent[],
): void {
  const state: IcsCalendarSyncCacheState = {
    events,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey(subscriptionId), JSON.stringify(state));
}

/**
 * Kaldes når et abonnement slettes (IcsSubscriptionsPanel), så en senere
 * "hele listen kunne ikke hentes"-fallback ikke risikerer at genindsætte
 * aftaler fra et abonnement, familien allerede har fjernet.
 */
export function clearCachedIcsEvents(subscriptionId: string): void {
  window.localStorage.removeItem(storageKey(subscriptionId));
}

export interface IcsCalendarSyncCacheEntry {
  subscriptionId: string;
  state: IcsCalendarSyncCacheState;
}

export function listCachedIcsSyncEntries(): IcsCalendarSyncCacheEntry[] {
  const entries: IcsCalendarSyncCacheEntry[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;

    const subscriptionId = key.slice(STORAGE_KEY_PREFIX.length);
    const state = getCachedIcsEvents(subscriptionId);

    if (state) {
      entries.push({ subscriptionId, state });
    }
  }

  return entries;
}
