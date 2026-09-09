import { ExternalCalendarConnectionBanner } from "./ExternalCalendarConnectionBanner";
import type { CalendarProviderHealth } from "../models/calendarProviderHealth";

interface CalendarConnectionBannersProps {
  isGoogleCalendarStatusLoading: boolean;
  isGoogleCalendarConnected: boolean;
  isOutlookCalendarConfigured: boolean;
  outlookCalendarConfigurationError: string | undefined;
  isOutlookCalendarConnected: boolean;
  wasOutlookCalendarEverConnected: boolean;
  isAttemptingOutlookSilentReconnect: boolean;
  providerHealth: CalendarProviderHealth[];
  onRetry: () => void;
}

export function CalendarConnectionBanners({
  isGoogleCalendarStatusLoading,
  isGoogleCalendarConnected,
  isOutlookCalendarConfigured,
  outlookCalendarConfigurationError,
  isOutlookCalendarConnected,
  wasOutlookCalendarEverConnected,
  isAttemptingOutlookSilentReconnect,
  providerHealth,
  onRetry,
}: CalendarConnectionBannersProps) {
  return (
    <>
      {!isGoogleCalendarStatusLoading && (
        <ExternalCalendarConnectionBanner
          providerLabel="Google"
          isConfigured
          isConnected={isGoogleCalendarConnected}
          wasEverConnected
          isAttemptingSilentReconnect={false}
          health={providerHealth.find((health) => health.providerId === "google")}
          onRetry={onRetry}
        />
      )}

      {/*
        Outlook er midlertidigt slået fra uden en configurationError (se
        outlookCalendarConfig.ts) — vises slet ikke her, mens den er ukonfigureret,
        i stedet for en "ikke konfigureret"-boks ingen kan handle på endnu.
        Dukker automatisk op igen, når Outlook genaktiveres.
      */}
      {isOutlookCalendarConfigured && (
        <ExternalCalendarConnectionBanner
          providerLabel="Outlook"
          isConfigured={isOutlookCalendarConfigured}
          configurationError={outlookCalendarConfigurationError}
          isConnected={isOutlookCalendarConnected}
          wasEverConnected={wasOutlookCalendarEverConnected}
          isAttemptingSilentReconnect={isAttemptingOutlookSilentReconnect}
          health={providerHealth.find((health) => health.providerId === "outlook")}
          onRetry={onRetry}
        />
      )}
    </>
  );
}
