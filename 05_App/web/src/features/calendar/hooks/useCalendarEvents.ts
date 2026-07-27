import { useCallback, useEffect, useState } from "react";

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
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        setIsLoading(true);
        setError(null);

        const loadedEvents =
          await CalendarService.getEvents();

        if (isMounted) {
          setEvents(loadedEvents);
        }
      } catch {
        if (isMounted) {
          setError(
            "Kalenderaftalerne kunne ikke indlæses.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  const createEvent = useCallback(
    async (
      input: CreateCalendarEventInput,
    ): Promise<CalendarEvent> => {
      try {
        setIsSaving(true);
        setError(null);

        const createdEvent =
          await CalendarService.createEvent(input);

        setEvents((currentEvents) =>
          [...currentEvents, createdEvent].sort(
            (firstEvent, secondEvent) =>
              new Date(firstEvent.start).getTime() -
              new Date(secondEvent.start).getTime(),
          ),
        );

        return createdEvent;
      } catch {
        setError("Aftalen kunne ikke oprettes.");

        throw new Error("Aftalen kunne ikke oprettes.");
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  return {
    events,
    isLoading,
    isSaving,
    error,
    createEvent,
  };
}