import {
  familyPseudoMemberId,
  type CalendarEvent,
} from "../models/calendarEvent";

/**
 * Fordeler en aftale til præcis én type kolonne i familieplanlæggeren.
 * Fælles-/flerpersonsaftaler vises i familie-kolonnen, mens aftaler med én
 * ejer vises hos den pågældende person. Det forhindrer, at den samme aftale
 * ligner dubletter på tværs af familie- og personkolonnerne.
 */
export function getPlannerEventsForColumn(
  dayEvents: readonly CalendarEvent[],
  columnId: string,
): CalendarEvent[] {
  if (columnId === familyPseudoMemberId) {
    return dayEvents.filter(
      (event) =>
        event.ownerIds.includes(familyPseudoMemberId) ||
        event.ownerIds.length !== 1,
    );
  }

  return dayEvents.filter(
    (event) =>
      event.ownerIds.length === 1 && event.ownerIds[0] === columnId,
  );
}
