import { useEffect, useState } from "react";

import type { CalendarEvent } from "../models/calendarEvent";
import { CalendarService } from "../services/CalendarService";

interface UseCalendarEventsResult {
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);

        const calendarEvents = await CalendarService.getEvents();

        if (isMounted) {
          setEvents(calendarEvents);
        }
      } catch {
        if (isMounted) {
          setError("Kalenderaftalerne kunne ikke indlæses.");
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

  return {
    events,
    isLoading,
    error,
  };
}