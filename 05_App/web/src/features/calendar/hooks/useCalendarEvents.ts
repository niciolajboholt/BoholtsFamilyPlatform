import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import {
  allCalendarEventRange,
} from "../models/calendarProvider";
import type { CalendarProvider } from "../providers/CalendarProvider";
import {
  calendarProvider,
} from "../providers/calendarProviderFactory";

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  hasLoadedEvents: boolean;
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

export function useCalendarEvents(
  provider: CalendarProvider = calendarProvider,
): UseCalendarEventsResult {
  const [events, setEvents] = useState<
    CalendarEvent[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [hasLoadedEvents, setHasLoadedEvents] =
    useState(false);

  const isRefreshingRef = useRef(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const refreshEvents = useCallback(
    async (): Promise<void> => {
      if (isRefreshingRef.current) {
        return;
      }

      isRefreshingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const loadedEvents =
          await provider.getEvents(
            allCalendarEventRange,
          );

        setEvents(loadedEvents);
        setHasLoadedEvents(true);
      } catch (caughtError: unknown) {
        setError(
          getErrorMessage(caughtError),
        );
      } finally {
        setIsLoading(false);
        isRefreshingRef.current = false;
      }
    },
    [provider],
  );

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  const createEvent = useCallback(
    async (
      input: CreateCalendarEventInput,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);

      try {
        const createdEvent =
          await provider.createEvent(
            input,
          );

        await refreshEvents();

        return createdEvent;
      } finally {
        setIsSaving(false);
      }
    },
    [provider, refreshEvents],
  );

  const updateEvent = useCallback(
    async (
      event: CalendarEvent,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);

      try {
        const updatedEvent =
          await provider.updateEvent(
            event,
          );

        await refreshEvents();

        return updatedEvent;
      } finally {
        setIsSaving(false);
      }
    },
    [provider, refreshEvents],
  );

  const deleteEvent = useCallback(
    async (
      eventId: string,
    ): Promise<void> => {
      setIsSaving(true);

      try {
        await provider.deleteEvent(
          eventId,
        );

        await refreshEvents();
      } finally {
        setIsSaving(false);
      }
    },
    [provider, refreshEvents],
  );

  const restoreEvent = useCallback(
    async (
      event: CalendarEvent,
    ): Promise<CalendarEvent> => {
      setIsSaving(true);

      try {
        const restoredEvent =
          await provider.restoreEvent(
            event,
          );

        await refreshEvents();

        return restoredEvent;
      } finally {
        setIsSaving(false);
      }
    },
    [provider, refreshEvents],
  );

  return {
    events,
    hasLoadedEvents,
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
