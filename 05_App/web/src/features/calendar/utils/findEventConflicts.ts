import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";

export interface EventConflictCandidate {
  start: string;
  end: string;
  ownerIds: CalendarOwnerId[];
}

// Eksporteret så findAllCalendarConflicts.ts (Sprint 26) kan genbruge
// præcis samme regel til at markere konflikter i selve kalendervisningen,
// i stedet for at duplikere den.
export function hasSharedOwner(
  firstOwnerIds: CalendarOwnerId[],
  secondOwnerIds: CalendarOwnerId[],
): boolean {
  return firstOwnerIds.some((ownerId) =>
    secondOwnerIds.includes(ownerId),
  );
}

export function eventsOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  const firstStartTime = new Date(firstStart).getTime();
  const firstEndTime = new Date(firstEnd).getTime();
  const secondStartTime = new Date(secondStart).getTime();
  const secondEndTime = new Date(secondEnd).getTime();

  if (
    Number.isNaN(firstStartTime) ||
    Number.isNaN(firstEndTime) ||
    Number.isNaN(secondStartTime) ||
    Number.isNaN(secondEndTime)
  ) {
    return false;
  }

  return (
    firstStartTime < secondEndTime &&
    firstEndTime > secondStartTime
  );
}

export function findEventConflicts(
  candidate: EventConflictCandidate,
  events: CalendarEvent[],
  excludedEventId?: string,
): CalendarEvent[] {
  return events.filter((event) => {
    if (
      excludedEventId &&
      event.id === excludedEventId
    ) {
      return false;
    }

    if (
      !hasSharedOwner(
        candidate.ownerIds,
        event.ownerIds,
      )
    ) {
      return false;
    }

    return eventsOverlap(
      candidate.start,
      candidate.end,
      event.start,
      event.end,
    );
  });
}