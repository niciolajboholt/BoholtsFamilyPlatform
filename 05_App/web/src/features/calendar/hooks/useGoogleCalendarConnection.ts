import { useCallback, useEffect, useState } from "react";

import { googleCalendarSession } from "../providers/calendarProviderFactory";

interface UseGoogleCalendarConnectionResult {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  wasEverConnected: boolean;
  isAttemptingSilentReconnect: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * React-binding til appens generiske kalenderforbindelse. Google-detaljer
 * forbliver afgrænset til provider-laget.
 */
export function useGoogleCalendarConnection(): UseGoogleCalendarConnectionResult {
  const [isConnected, setIsConnected] = useState(
    () => googleCalendarSession.isConnected(),
  );

  const [wasEverConnected, setWasEverConnected] = useState(
    () => googleCalendarSession.wasEverConnected(),
  );

  const [isAttemptingSilentReconnect, setIsAttemptingSilentReconnect] =
    useState(false);

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

  useEffect(() => {
    if (
      !googleCalendarSession.isConfigured() ||
      googleCalendarSession.isConnected() ||
      !googleCalendarSession.wasEverConnected()
    ) {
      return;
    }

    let isCurrent = true;

    // Sprint 14: try to restore the session invisibly (no Google prompt)
    // when we know the user connected before. This effect synchronizes
    // React state with an external system (Google's auth state) — the
    // canonical use case for an effect — but the state change is only
    // "new" once, on the mount where a silent reconnect is worth trying,
    // so the lint rule's static check can't see it's not cascading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAttemptingSilentReconnect(true);

    void googleCalendarSession.attemptSilentReconnect().then((didReconnect) => {
      if (!isCurrent) {
        return;
      }

      setIsAttemptingSilentReconnect(false);

      if (didReconnect) {
        setIsConnected(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return {
    isConfigured: googleCalendarSession.isConfigured(),
    configurationError: googleCalendarSession.getConfigurationError(),
    isConnected,
    wasEverConnected,
    isAttemptingSilentReconnect,
    connect,
    disconnect,
  };
}
