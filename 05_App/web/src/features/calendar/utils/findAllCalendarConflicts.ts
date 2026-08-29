import type { CalendarEvent } from "../models/calendarEvent";
import { familyPseudoMemberId } from "../models/calendarEvent";
import { eventsOverlap } from "./findEventConflicts";

const nonBlockingGoogleCalendarMarkers = [
  "#holiday@group.v.calendar.google.com",
  "#weeknum@group.v.calendar.google.com",
];

function decodedCalendarReference(sourceId: string): string {
  const separatorIndex = sourceId.indexOf(":");
  const encodedReference =
    separatorIndex >= 0 ? sourceId.slice(separatorIndex + 1) : sourceId;

  try {
    return decodeURIComponent(encodedReference).toLowerCase();
  } catch {
    return encodedReference.toLowerCase();
  }
}

/**
 * Abonnementskalendere (ICS) er kun et delt informationslag og skal aldrig
 * skabe advarselstrekanter. Det samme gælder Googles indbyggede helligdags-
 * og ugenummerkalendere, som ellers overlapper næsten alt på den pågældende
 * dag uden at være reelle aftaler.
 */
export function isExcludedFromCalendarConflicts(
  event: CalendarEvent,
): boolean {
  if (event.source === "ics") {
    return true;
  }

  if (event.source !== "google") {
    return false;
  }

  const calendarReference = decodedCalendarReference(event.sourceId);

  return nonBlockingGoogleCalendarMarkers.some((marker) =>
    calendarReference.includes(marker),
  );
}

function isFamilyCalendarEvent(event: CalendarEvent): boolean {
  return event.ownerIds.includes(familyPseudoMemberId);
}

/**
 * En reel konflikt findes kun inden for samme kalender, eller mellem
 * Familien-kalenderen og en anden kalender. To personkalendere må gerne
 * overlappe hinanden uden en advarsel, selv hvis begge er knyttet til det
 * samme familiemedlem.
 */
export function shouldCalendarEventsConflict(
  first: CalendarEvent,
  second: CalendarEvent,
): boolean {
  if (
    isExcludedFromCalendarConflicts(first) ||
    isExcludedFromCalendarConflicts(second)
  ) {
    return false;
  }

  return (
    first.sourceId === second.sourceId ||
    isFamilyCalendarEvent(first) ||
    isFamilyCalendarEvent(second)
  );
}

/**
 * Finder alle viste aftaler, som både følger kalenderreglen ovenfor og
 * overlapper tidsmæssigt. Det samme id-sæt deles af måned-, uge-, dag-,
 * familie- og listevisningen.
 */
export function findAllCalendarConflicts(
  events: CalendarEvent[],
): Set<string> {
  const conflictingEventIds = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const first = events[i];
      const second = events[j];

      if (!shouldCalendarEventsConflict(first, second)) {
        continue;
      }

      if (!eventsOverlap(first.start, first.end, second.start, second.end)) {
        continue;
      }

      conflictingEventIds.add(first.id);
      conflictingEventIds.add(second.id);
    }
  }

  return conflictingEventIds;
}
