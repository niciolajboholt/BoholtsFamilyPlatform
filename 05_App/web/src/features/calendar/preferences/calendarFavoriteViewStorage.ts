import type { CalendarView } from "../models/calendarView";

const STORAGE_KEY = "boholts-calendar-favorite-view";

const validViews: readonly CalendarView[] = ["month", "week", "day", "planner"];

function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === "string" && (validViews as readonly string[]).includes(value);
}

function readFavorites(): Record<string, CalendarView> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};

    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const favorites: Record<string, CalendarView> = {};

    for (const [memberId, view] of Object.entries(parsed as Record<string, unknown>)) {
      if (isCalendarView(view)) {
        favorites[memberId] = view;
      }
    }

    return favorites;
  } catch {
    return {};
  }
}

function writeFavorites(favorites: Record<string, CalendarView>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage kan være utilgængelig (privat browsing, slået fra) —
    // valget gemmes blot ikke til næste besøg.
  }
}

/**
 * Hvert familiemedlems foretrukne kalendervisning (måned/uge/dag/familie) —
 * gemmes pr. enhed og nøglet på medlem-id, samme mønster som
 * currentMemberStorage.ts. Bruges til at åbne kalenderen direkte i den
 * visning, medlemmet selv har valgt som favorit, i stedet for den
 * viewport-baserede standard (getDefaultCalendarView).
 */
export function getFavoriteCalendarView(memberId: string | null): CalendarView | null {
  if (!memberId) {
    return null;
  }

  return readFavorites()[memberId] ?? null;
}

export function setFavoriteCalendarView(memberId: string, view: CalendarView): void {
  const favorites = readFavorites();
  favorites[memberId] = view;
  writeFavorites(favorites);
}

export function clearFavoriteCalendarView(memberId: string): void {
  const favorites = readFavorites();
  delete favorites[memberId];
  writeFavorites(favorites);
}
