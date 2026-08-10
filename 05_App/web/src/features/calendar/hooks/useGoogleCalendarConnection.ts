import { useCallback, useEffect, useState } from "react";

interface UseGoogleCalendarConnectionResult {
  isLoading: boolean;
  isConnected: boolean;
  reconnect: () => void;
}

interface CalendarStatusResponse {
  connected: boolean;
}

/**
 * Fase 3: Google-samtykket sker allerede ved login (Fase 1) — "forbindelse"
 * er derfor blot "har brugeren en google_connections-række på serveren".
 * Der er intet klient-side token eller GSI-script tilbage; en manglende
 * forbindelse (fx fordi brugeren har tilbagekaldt adgangen hos Google) løses
 * ved at gennemføre login-flowet igen, ikke en separat "forbind"-handling.
 */
export function useGoogleCalendarConnection(): UseGoogleCalendarConnectionResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/calendar/status", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        const data: CalendarStatusResponse = await response.json();
        return data.connected;
      })
      .catch(() => false)
      .then((connected) => {
        if (!isCancelled) {
          setIsConnected(connected);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const reconnect = useCallback((): void => {
    window.location.href = "/auth/google/begin";
  }, []);

  return { isLoading, isConnected, reconnect };
}
