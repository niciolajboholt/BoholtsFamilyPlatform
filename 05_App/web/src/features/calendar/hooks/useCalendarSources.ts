import { useCallback, useEffect, useRef, useState } from "react";

import type { CalendarSource } from "../models/calendarProvider";
import type { CalendarProvider } from "../providers/CalendarProvider";
import { calendarProvider } from "../providers/calendarProviderFactory";
import {
  getVisibleCalendarSourceIds,
  saveVisibleCalendarSourceIds,
} from "../preferences/calendarSourceVisibilityStorage";

interface UseCalendarSourcesResult {
  calendarSources: CalendarSource[];
  visibleCalendarSourceIds: string[];
  isLoading: boolean;
  hasLoadedSources: boolean;
  error: string | null;
  toggleCalendarSource: (sourceId: string) => void;
  showAll: () => void;
  refresh: () => Promise<void>;
}

export function useCalendarSources(
  provider: CalendarProvider = calendarProvider,
): UseCalendarSourcesResult {
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([]);
  const [visibleCalendarSourceIds, setVisibleCalendarSourceIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedSources, setHasLoadedSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    const requestGeneration = ++requestGenerationRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const sources = await provider.getCalendars();

      if (requestGeneration !== requestGenerationRef.current) return;

      setCalendarSources(sources);
      setVisibleCalendarSourceIds(getVisibleCalendarSourceIds(sources));
      setHasLoadedSources(true);
    } catch {
      if (requestGeneration === requestGenerationRef.current) {
        setError("Kalenderkilder kunne ikke indlæses.");
      }
    } finally {
      if (requestGeneration === requestGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, [provider]);

  useEffect(() => {
    // Initial loading is an external provider synchronization. The hook starts
    // in loading state, so the synchronous loading/error updates are
    // idempotent on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    return () => {
      requestGenerationRef.current += 1;
    };
  }, [refresh]);

  const updateVisibility = useCallback((visibleIds: string[]) => {
    setVisibleCalendarSourceIds(visibleIds);
    saveVisibleCalendarSourceIds(calendarSources, visibleIds);
  }, [calendarSources]);

  const toggleCalendarSource = useCallback((sourceId: string) => {
    updateVisibility(visibleCalendarSourceIds.includes(sourceId)
      ? visibleCalendarSourceIds.filter((id) => id !== sourceId)
      : [...visibleCalendarSourceIds, sourceId]);
  }, [updateVisibility, visibleCalendarSourceIds]);

  const showAll = useCallback(() => {
    updateVisibility(calendarSources.map((source) => source.id));
  }, [calendarSources, updateVisibility]);

  return { calendarSources, visibleCalendarSourceIds, isLoading, hasLoadedSources, error, toggleCalendarSource, showAll, refresh };
}
