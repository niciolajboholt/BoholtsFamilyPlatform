import type { CalendarEvent, CalendarOwnerId } from "../models/calendarEvent";

/**
 * Ejeren af den kortlagte kalender må se sine egne private detaljer. Alle
 * andre får kun tidspunkt og "Optaget". Manglende profilkobling redigerer
 * konservativt i stedet for at gætte på en identitet.
 */
export function redactCalendarEventForViewer(
  event: CalendarEvent,
  viewerOwnerId: CalendarOwnerId | undefined,
): CalendarEvent {
  if (
    event.privacy !== "busy" ||
    (viewerOwnerId !== undefined && event.ownerIds.includes(viewerOwnerId))
  ) {
    return event;
  }

  return {
    ...event,
    title: "Optaget",
    description: undefined,
    location: undefined,
    privacyRedacted: true,
  };
}
