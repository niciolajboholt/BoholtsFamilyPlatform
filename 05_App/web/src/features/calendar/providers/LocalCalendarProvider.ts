import { calendarOwners } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type {
  CalendarEventRange,
  CalendarSource,
} from "../models/calendarProvider";
import {
  CalendarService,
} from "../services/CalendarService";
import type { CalendarProvider } from "./CalendarProvider";
import { toCalendarProviderError } from "./calendarProviderErrors";

function isEventWithinRange(
  event: CalendarEvent,
  range: CalendarEventRange,
): boolean {
  return (
    new Date(event.start).getTime() <
      new Date(range.end).getTime() &&
    new Date(event.end).getTime() >=
      new Date(range.start).getTime()
  );
}

/**
 * Adapter for den nuværende demo- og localStorage-baserede kalender.
 * Storage keys og validering forbliver ejet af CalendarService.
 */
export class LocalCalendarProvider
  implements CalendarProvider
{
  async getCalendars(): Promise<CalendarSource[]> {
    return Object.values(calendarOwners).map(
      (owner) => ({
        id: owner.id,
        name: owner.name,
        providerType: "local",
        color: owner.color,
        isVisible: true,
        isReadOnly: false,
      }),
    );
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    try {
      const events =
        await CalendarService.getEvents();

      return events.filter((event) =>
        isEventWithinRange(event, range),
      );
    } catch (error: unknown) {
      throw toCalendarProviderError(error);
    }
  }

  async createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CalendarEvent> {
    try {
      return await CalendarService.createEvent(input);
    } catch (error: unknown) {
      throw toCalendarProviderError(error);
    }
  }

  async updateEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    try {
      return await CalendarService.updateEvent(event);
    } catch (error: unknown) {
      throw toCalendarProviderError(error);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await CalendarService.deleteEvent(eventId);
    } catch (error: unknown) {
      throw toCalendarProviderError(error);
    }
  }

  async restoreEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    try {
      return await CalendarService.restoreEvent(event);
    } catch (error: unknown) {
      throw toCalendarProviderError(error);
    }
  }
}
