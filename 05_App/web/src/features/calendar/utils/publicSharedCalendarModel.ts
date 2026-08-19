import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";

// Sprint 26: rene hjælpefunktioner for PublicSharedCalendarPage.tsx,
// udskilt i egen fil (i stedet for at eksportere dem fra selve siden) —
// react-refresh/only-export-components tillader kun komponent-eksporter
// fra en .tsx-side.

export interface PublicCalendarEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  memberName: string;
  memberColor: string;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

// Serveren henter kun ±1 måned omkring "nu" (se
// publicCalendar.ts's getPublicCalendarRange) — månedsnavigationen
// begrænses tilsvarende, så man ikke kan bladre til en måned uden data.
export function toMonthNavBounds(referenceDate: Date): { min: Date; max: Date } {
  return {
    min: startOfMonth(addMonths(referenceDate, -1)),
    max: startOfMonth(addMonths(referenceDate, 1)),
  };
}

/**
 * Serveren kender ikke familiemedlemmernes ids/CalendarOwner-form (den
 * offentlige aftale-liste er bevidst forenklet, uden id'er) — udleder en
 * stabil, syntetisk CalendarOwner-liste + CalendarEvent-liste herfra, kun
 * til at genbruge MonthCalendar/EventList's eksisterende visning.
 */
export function toCalendarModel(
  events: PublicCalendarEvent[],
): { members: CalendarOwner[]; events: CalendarEvent[] } {
  const membersByName = new Map<string, CalendarOwner>();

  for (const event of events) {
    if (!membersByName.has(event.memberName)) {
      membersByName.set(event.memberName, {
        id: `share-member:${event.memberName}`,
        name: event.memberName,
        color: event.memberColor,
      });
    }
  }

  const calendarEvents: CalendarEvent[] = events.map((event, index) => ({
    id: `share-event:${index}`,
    title: event.title,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    ownerIds: [`share-member:${event.memberName}`],
    source: "internal",
    sourceId: "share:readonly",
  }));

  return { members: [...membersByName.values()], events: calendarEvents };
}
