import { useCallback, useEffect, useState } from "react";

import { outlookCalendarSession } from "../providers/calendarProviderFactory";

interface UseOutlookCalendarConnectionResult {
  isConfigured: boolean;
  configurationError?: string;
  isConnected: boolean;
  wasEverConnected: boolean;
  isAttemptingSilentReconnect: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

/**
 * React-binding til appens generiske kalenderforbindelse — mirror af
 * useGoogleCalendarConnection.ts. Outlook-detaljer forbliver afgrænset til
 * provider-laget.
 */
export function useOutlookCalendarConnection(): UseOutlookCalendarConnectionResult {
  const [isConnected, setIsConnected] = useState(
    () => outlookCalendarSession.isConnected(),
  );

  const [wasEverConnected, setWasEverConnected] = useState(
    () => outlookCalendarSession.wasEverConnected(),
  );

  const [isAttemptingSilentReconnect, setIsAttemptingSilentReconnect] =
    useState(false);

  const connect = useCallback(async (): Promise<void> => {
    await outlookCalendarSession.connect();
    setIsConnected(true);
    setWasEverConnected(true);
  }, []);

  const disconnect = useCallback((): void => {
    outlookCalendarSession.disconnect();
    setIsConnected(false);
    setWasEverConnected(false);
  }, []);

  useEffect(() => {
    if (
      !outlookCalendarSession.isConfigured() ||
      outlookCalendarSession.isConnected() ||
      !outlookCalendarSession.wasEverConnected()
    ) {
      return;
    }

    let isCurrent = true;

    // Mirror af Sprint 14's Google-genopkobling: synkroniserer React-state
    // med et eksternt system (MSAL's session), kun forsøgt én gang ved
    // mount, hvor det er relevant.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAttemptingSilentReconnect(true);

    void outlookCalendarSession.attemptSilentReconnect().then((didReconnect) => {
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
    isConfigured: outlookCalendarSession.isConfigured(),
    configurationError: outlookCalendarSession.getConfigurationError(),
    isConnected,
    wasEverConnected,
    isAttemptingSilentReconnect,
    connect,
    disconnect,
  };
}
