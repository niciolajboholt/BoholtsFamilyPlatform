import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type {
  CalendarEventRange,
  CalendarSource,
} from "../models/calendarProvider";

/**
 * Provider-kontrakt mellem kalenderens domæne og dens datakilder.
 *
 * Implementeringer må oversætte leverandørspecifikke modeller og fejl, men
 * React-komponenter og hooks arbejder kun med denne kontrakt.
 */
export interface CalendarProvider {
  getCalendars(): Promise<CalendarSource[]>;
  getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]>;
  createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CalendarEvent>;
  updateEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent>;
  deleteEvent(
    eventId: string,
    sourceId?: string,
  ): Promise<void>;
  restoreEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent>;
  /**
   * Fase 8: ISO-tidsstempel for hvor gammel den senest returnerede
   * getEvents()-liste er, hvis den kom fra en lokal offline-fallback i
   * stedet for en frisk hentning — `null`/udeladt ellers. Valgfri, da ikke
   * alle providere (endnu) understøtter et offline-fallback.
   */
  getOfflineCacheAsOf?(): string | null;
}
