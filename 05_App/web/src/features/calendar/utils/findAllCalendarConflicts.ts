import type { CalendarEvent } from "../models/calendarEvent";
import { eventsOverlap, hasSharedOwner } from "./findEventConflicts";

/**
 * Sprint 26: samme konfliktregel som findEventConflicts.ts (delt ejer +
 * tidsmæssigt overlap), men parvis over et helt sæt viste aftaler — bruges
 * til en vedvarende visuel markering i selve kalendervisningen, i
 * modsætning til findEventConflicts.ts, som kun tjekker ét kandidat-udkast
 * (opret/redigér-dialogen) mod resten.
 */
export function findAllCalendarConflicts(
  events: CalendarEvent[],
): Set<string> {
  const conflictingEventIds = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const first = events[i];
      const second = events[j];

      if (!hasSharedOwner(first.ownerIds, second.ownerIds)) {
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
