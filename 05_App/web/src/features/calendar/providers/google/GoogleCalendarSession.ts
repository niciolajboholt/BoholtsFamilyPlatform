import { getGoogleCalendarConfig } from "./googleCalendarConfig";
import { CalendarProviderError } from "../calendarProviderErrors";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }): GoogleTokenClient;
      revoke(token: string, callback: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
export const googleCalendarScopes = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

let googleIdentityScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = googleIdentityScriptUrl;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new CalendarProviderError(
      "network",
      "Google Kalender kunne ikke indlÃ¦ses.",
    ));
    document.head.append(script);
  });

  return googleIdentityScriptPromise;
}

/**
 * Holder kun et kortlivet Google-adgangstoken i hukommelsen. Tokens skrives
 * aldrig til localStorage eller til konsollen.
 */
export class GoogleCalendarSession {
  private accessToken: string | null = null;

  isConfigured(): boolean {
    return getGoogleCalendarConfig().enabled;
  }

  getConfigurationError(): string | undefined {
    return getGoogleCalendarConfig().configurationError;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isConnected(): boolean {
    return this.accessToken !== null;
  }

  async connect(): Promise<void> {
    const config = getGoogleCalendarConfig();

    if (!config.enabled || !config.clientId) {
      throw new CalendarProviderError(
        "unavailable",
        "Google Kalender er ikke konfigureret.",
      );
    }

    const clientId = config.clientId;

    await loadGoogleIdentityServices();

    const identityServices = window.google?.accounts.oauth2;

    if (!identityServices) {
      throw new CalendarProviderError(
        "unavailable",
        "Google Kalender kunne ikke startes.",
      );
    }

    await new Promise<void>((resolve, reject) => {
      const tokenClient = identityServices.initTokenClient({
        client_id: clientId,
        scope: googleCalendarScopes,
        callback: (response) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
            resolve();
            return;
          }

          reject(new CalendarProviderError(
            "authentication",
            "Google Kalender blev ikke forbundet.",
          ));
        },
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  disconnect(): void {
    const token = this.accessToken;
    this.accessToken = null;

    if (token && window.google?.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => undefined);
    }
  }
}
