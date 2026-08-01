import { getGoogleCalendarConfig } from "./googleCalendarConfig";
import { CalendarProviderError } from "../calendarProviderErrors";
import { raceWithTimeout } from "../raceWithTimeout";

export { raceWithTimeout };

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

const wasConnectedStorageKey = "google-calendar-was-connected";

// UI-only hint so the connect button can say "Genforbind" after a reload,
// instead of "Forbind", for a user who has connected before. This is never
// the access token itself (still memory-only, see class doc below) — just
// a boolean breadcrumb, so it carries no security implication.
function markWasConnected(): void {
  try {
    window.localStorage.setItem(wasConnectedStorageKey, "true");
  } catch {
    // localStorage may be unavailable (private browsing, disabled storage);
    // the hint is UX-only, so failing silently is fine.
  }
}

function clearWasConnected(): void {
  try {
    window.localStorage.removeItem(wasConnectedStorageKey);
  } catch {
    // see markWasConnected
  }
}

function readWasConnected(): boolean {
  try {
    return window.localStorage.getItem(wasConnectedStorageKey) === "true";
  } catch {
    return false;
  }
}

const silentReconnectTimeoutMs = 4000;

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
      "Google Kalender kunne ikke indlæses.",
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

  wasEverConnected(): boolean {
    return readWasConnected();
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
            markWasConnected();
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

  /**
   * Forsøger at genoprette forbindelsen uden en synlig Google-prompt, ved at
   * bede om et token med prompt:"" — det lykkes kun, hvis brugeren stadig
   * har en aktiv Google-session og tidligere har givet samtykke. Fejler den
   * (ingen session, tredjeparts-cookies blokeret, eller intet svar inden
   * for tidsgrænsen), forbliver brugeren i den kendte "skal genforbindes"
   * tilstand fra Sprint 13 — aldrig en fejlbesked, aldrig en hængende UI.
   */
  async attemptSilentReconnect(): Promise<boolean> {
    const config = getGoogleCalendarConfig();

    if (!config.enabled || !config.clientId) {
      return false;
    }

    try {
      await loadGoogleIdentityServices();
    } catch {
      return false;
    }

    const identityServices = window.google?.accounts.oauth2;

    if (!identityServices) {
      return false;
    }

    const clientId = config.clientId;

    const attempt = new Promise<boolean>((resolve) => {
      const tokenClient = identityServices.initTokenClient({
        client_id: clientId,
        scope: googleCalendarScopes,
        callback: (response) => {
          if (response.access_token) {
            this.accessToken = response.access_token;
            markWasConnected();
            resolve(true);
            return;
          }

          resolve(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: "" });
    });

    return raceWithTimeout(attempt, silentReconnectTimeoutMs, false);
  }

  disconnect(): void {
    const token = this.accessToken;
    this.accessToken = null;
    clearWasConnected();

    if (token && window.google?.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => undefined);
    }
  }
}
