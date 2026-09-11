import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import {
  getDefaultCalendarEventRange,
} from "../models/calendarProvider";
import type { CalendarProvider } from "../providers/CalendarProvider";
import {
  calendarProvider,
} from "../providers/calendarProviderFactory";
import type { CalendarProviderHealth } from "../models/calendarProviderHealth";

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  hasLoadedEvents: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  providerHealth: CalendarProviderHealth[];
  createEvent: (
    input: CreateCalendarEventInput,
  ) => Promise<CalendarEvent>;
  updateEvent: (
    event: CalendarEvent,
  ) => Promise<CalendarEvent>;
  deleteEvent: (
    eventId: string,
    sourceId?: string,
  ) => Promise<void>;
  restoreEvent: (
    event: CalendarEvent,
  ) => Promise<CalendarEvent>;
  refreshEvents: () => Promise<void>;
}

interface CalendarProviderHealthReporter {
  getProviderHealth(): CalendarProviderHealth[];
}

function getProviderHealth(
  provider: CalendarProvider,
): CalendarProviderHealth[] {
  if (
    "getProviderHealth" in provider &&
    typeof provider.getProviderHealth === "function"
  ) {
    return (provider as CalendarProviderHealthReporter)
      .getProviderHealth();
  }

  return [];
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

  const requestGenerationRef = useRef(0);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const [providerHealth, setProviderHealth] = useState<
    CalendarProviderHealth[]
  >(() => getProviderHealth(provider));

  const refreshEvents = useCallback(
    async (): Promise<void> => {
      const requestGeneration = ++requestGenerationRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const loadedEvents =
          await provider.getEvents(
            getDefaultCalendarEventRange(),
          );

        if (requestGeneration !== requestGenerationRef.current) {
          return;
        }

        setEvents(loadedEvents);
        setProviderHealth(getProviderHealth(provider));
        setHasLoadedEvents(true);
      } catch (caughtError: unknown) {
        if (requestGeneration === requestGenerationRef.current) {
          setError(
            getErrorMessage(caughtError),
          );
        }
      } finally {
        if (requestGeneration === requestGenerationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [provider],
  );

  useEffect(() => {
    // refreshEvents' setIsLoading(true)/setError(null) are no-ops on this
    // first call (isLoading/error already start at true/null above), so
    // there is no cascading render here. The lint rule can't see that this
    // is idempotent on mount, only that refreshEvents sets state at all.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshEvents();

    return () => {
      requestGenerationRef.current += 1;
    };
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
      sourceId?: string,
    ): Promise<void> => {
      setIsSaving(true);

      try {
        const event = events.find(
          (currentEvent) =>
            currentEvent.id === eventId,
        );

        await provider.deleteEvent(
          eventId,
          sourceId ?? event?.sourceId,
        );

        await refreshEvents();
      } finally {
        setIsSaving(false);
      }
    },
    [events, provider, refreshEvents],
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
    providerHealth,
    createEvent,
    updateEvent,
    deleteEvent,
    restoreEvent,
    refreshEvents,
  };
}
