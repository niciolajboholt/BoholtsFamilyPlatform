export interface OutlookCalendarConfig {
  enabled: boolean;
  clientId?: string;
  configurationError?: string;
}

export function getOutlookCalendarConfig(): OutlookCalendarConfig {
  const enabled =
    import.meta.env.VITE_OUTLOOK_CALENDAR_ENABLED?.trim().toLowerCase() === "true";
  const clientId = import.meta.env.VITE_OUTLOOK_CLIENT_ID?.trim();

  if (!enabled) {
    return { enabled: false };
  }

  if (!clientId) {
    return {
      enabled: false,
      configurationError: "Outlook Kalender mangler et client ID.",
    };
  }

  return { enabled: true, clientId };
}
