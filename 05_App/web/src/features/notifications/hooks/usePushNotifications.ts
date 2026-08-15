import { useCallback, useEffect, useState } from "react";

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscriptionStatus,
} from "../pushSubscription";

export type PushNotificationStatus =
  | "loading"
  | "unsupported"
  | "denied"
  | "subscribed"
  | "not-subscribed";

interface UsePushNotificationsResult {
  status: PushNotificationStatus;
  error: string | null;
  isBusy: boolean;
  enable: () => void;
  disable: () => void;
}

/**
 * Sprint 21, Del A: appens ene sted for push-notifikations-tilstand — kun
 * SettingsPage bruger den i dag, men holdt som en hook (ikke direkte kald i
 * komponenten) så en fremtidig statuslinje andre steder i UI'et kan bruge
 * den samme kilde.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [status, setStatus] = useState<PushNotificationStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refreshStatus = useCallback(async (): Promise<void> => {
    const current = await getPushSubscriptionStatus();
    setStatus(current);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    getPushSubscriptionStatus().then((current) => {
      if (!isCancelled) {
        setStatus(current);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const enable = useCallback((): void => {
    setError(null);
    setIsBusy(true);

    enablePushNotifications()
      .then(refreshStatus)
      .catch((enableError: unknown) => {
        setError(
          enableError instanceof Error
            ? enableError.message
            : "Kunne ikke aktivere notifikationer.",
        );
      })
      .finally(() => setIsBusy(false));
  }, [refreshStatus]);

  const disable = useCallback((): void => {
    setError(null);
    setIsBusy(true);

    disablePushNotifications()
      .then(refreshStatus)
      .catch((disableError: unknown) => {
        setError(
          disableError instanceof Error
            ? disableError.message
            : "Kunne ikke deaktivere notifikationer.",
        );
      })
      .finally(() => setIsBusy(false));
  }, [refreshStatus]);

  return { status, error, isBusy, enable, disable };
}
