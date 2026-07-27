import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { CalendarEvent } from "../models/calendarEvent";
import {
  CalendarService,
  type CreateCalendarEventInput,
} from "../services/CalendarService";

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  createEvent: (
    input: CreateCalendarEventInput,
  ) => Promise<CalendarEvent>;
  updateEvent: (
    event: CalendarEvent,
  ) => Promise<CalendarEvent>;
  deleteEvent: (
    eventId: string,
  ) => Promise<void>;
  restoreEvent: (
    event: CalendarEvent,
  ) => Promise<CalendarEvent>;
  refreshEvents: () => Promise<void>;
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Der opstod en ukendt fejl.";
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<
    CalendarEvent[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const refreshEvents = useCallback(
    async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const loadedEvents =
          await CalendarService.getEvents();

        setEvents(loadedEvents);
      } catch (caughtError: unknown) {
        setError(
          getErrorMessage(caughtError),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  const createEvent = useCallback(
    async (
      input: CreateCalendarEventInput,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);
      setError(null);

      try {
        const createdEvent =
          await CalendarService.createEvent(
            input,
          );

        await refreshEvents();

        return createdEvent;
      } catch (caughtError: unknown) {
        const message =
          getErrorMessage(caughtError);

        setError(message);

        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshEvents],
  );

  const updateEvent = useCallback(
    async (
      event: CalendarEvent,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);
      setError(null);

      try {
        const updatedEvent =
          await CalendarService.updateEvent(
            event,
          );

        await refreshEvents();

        return updatedEvent;
      } catch (caughtError: unknown) {
        const message =
          getErrorMessage(caughtError);

        setError(message);

        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshEvents],
  );

  const deleteEvent = useCallback(
    async (
      eventId: string,
    ): Promise<void> => {
      setIsSaving(true);
      setError(null);

      try {
        await CalendarService.deleteEvent(
          eventId,
        );

        await refreshEvents();
      } catch (caughtError: unknown) {
        const message =
          getErrorMessage(caughtError);

        setError(message);

        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshEvents],
  );

  const restoreEvent = useCallback(
    async (
      event: CalendarEvent,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);
      setError(null);

      try {
        const restoredEvent =
          await CalendarService.restoreEvent(
            event,
          );

        await refreshEvents();

        return restoredEvent;
      } catch (caughtError: unknown) {
        const message =
          getErrorMessage(caughtError);

        setError(message);

        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [refreshEvents],
  );

  return {
    events,
    isLoading,
    isSaving,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    restoreEvent,
    refreshEvents,
  };
}