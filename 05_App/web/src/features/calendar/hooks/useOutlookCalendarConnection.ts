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
    // Navigerer væk fra appen ved succes (se OutlookCalendarSession.connect)
    // — linjerne herunder når normalt ikke at køre i så fald. Forbindelsen
    // fanges i stedet op af ensureInitialized() i effekten nedenfor, når
    // appen genindlæses efter Microsofts login.
    await outlookCalendarSession.connect();
  }, []);

  const disconnect = useCallback((): void => {
    outlookCalendarSession.disconnect();
    setIsConnected(false);
    setWasEverConnected(false);
  }, []);

  useEffect(() => {
    if (!outlookCalendarSession.isConfigured()) {
      return;
    }

    let isCurrent = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAttemptingSilentReconnect(true);

    void outlookCalendarSession.ensureInitialized().then(() => {
      if (!isCurrent) {
        return;
      }

      // Behandler evt. et lige gennemført redirect-login (se
      // OutlookCalendarSession.ensureInitialized) — hvis det ikke var
      // tilfældet, forsøges en stille genopkobling, samme mønster som
      // Sprint 14's Google-genopkobling.
      if (outlookCalendarSession.isConnected()) {
        setIsConnected(true);
        setWasEverConnected(true);
        setIsAttemptingSilentReconnect(false);
        return;
      }

      if (!outlookCalendarSession.wasEverConnected()) {
        setIsAttemptingSilentReconnect(false);
        return;
      }

      void outlookCalendarSession.attemptSilentReconnect().then((didReconnect) => {
        if (!isCurrent) {
          return;
        }

        setIsAttemptingSilentReconnect(false);

        if (didReconnect) {
          setIsConnected(true);
        }
      });
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
