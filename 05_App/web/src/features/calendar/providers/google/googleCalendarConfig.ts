export interface GoogleCalendarConfig {
  enabled: boolean;
  clientId?: string;
  configurationError?: string;
}

export function getGoogleCalendarConfig(): GoogleCalendarConfig {
  const enabled = import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED === "true";
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  if (!enabled) {
    return { enabled: false };
  }

  if (!clientId) {
    return {
      enabled: false,
      configurationError: "Google Kalender mangler et client ID.",
    };
  }

  return { enabled: true, clientId };
}
