import { useCallback, useState } from "react";

import { googleCalendarSession } from "../providers/calendarProviderFactory";

interface UseGoogleCalendarConnectionResult {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  wasEverConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * React-binding til appens generiske kalenderforbindelse. Google-detaljer
 * forbliver afgrÃ¦nset til provider-laget.
 */
export function useGoogleCalendarConnection(): UseGoogleCalendarConnectionResult {
  const [isConnected, setIsConnected] = useState(
    () => googleCalendarSession.isConnected(),
  );

  const [wasEverConnected, setWasEverConnected] = useState(
    () => googleCalendarSession.wasEverConnected(),
  );

  const connect = useCallback(async (): Promise<void> => {
    await googleCalendarSession.connect();
    setIsConnected(true);
    setWasEverConnected(true);
  }, []);

  const disconnect = useCallback((): void => {
    googleCalendarSession.disconnect();
    setIsConnected(false);
    setWasEverConnected(false);
  }, []);

  return {
    isConfigured: googleCalendarSession.isConfigured(),
    configurationError: googleCalendarSession.getConfigurationError(),
    isConnected,
    wasEverConnected,
    connect,
    disconnect,
  };
}
