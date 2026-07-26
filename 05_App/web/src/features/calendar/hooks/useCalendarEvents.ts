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
    try {
      const calendarEvents = CalendarService.getEvents();

      setEvents(calendarEvents);
      setError(null);
    } catch {
      setError("Kalenderaftalerne kunne ikke indlæses.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    events,
    isLoading,
    error,
  };
}