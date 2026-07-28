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
  const isLoadingRef = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const sources = await provider.getCalendars();
      setCalendarSources(sources);
      setVisibleCalendarSourceIds(getVisibleCalendarSourceIds(sources));
    } catch {
      setError("Kalenderkilder kunne ikke indlæses.");
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [provider]);

  useEffect(() => {
    let isCurrent = true;

    async function loadSources() {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const sources = await provider.getCalendars();

        if (!isCurrent) return;

        setCalendarSources(sources);
        setVisibleCalendarSourceIds(getVisibleCalendarSourceIds(sources));
        setHasLoadedSources(true);
      } catch {
        if (isCurrent) setError("Kalenderkilder kunne ikke indlæses.");
      } finally {
        if (isCurrent) setIsLoading(false);
        isLoadingRef.current = false;
      }
    }

    void loadSources();

    return () => { isCurrent = false; };
  }, [provider]);

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
