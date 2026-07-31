import { PublicClientApplication } from "@azure/msal-browser";

import { getOutlookCalendarConfig } from "./outlookCalendarConfig";
import { CalendarProviderError } from "../calendarProviderErrors";
import { raceWithTimeout } from "../raceWithTimeout";

export const outlookCalendarScopes = ["Calendars.ReadWrite"];

const wasConnectedStorageKey = "outlook-calendar-was-connected";

// UI-only hint so the connect button can say "Genforbind" after a reload,
// instead of "Forbind" — mirrors GoogleCalendarSession's own flag. Never the
// access token itself, so it carries no security implication.
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

let msalInstancePromise: Promise<PublicClientApplication> | null = null;

function getMsalInstance(clientId: string): Promise<PublicClientApplication> {
  if (msalInstancePromise) {
    return msalInstancePromise;
  }

  msalInstancePromise = (async () => {
    const instance = new PublicClientApplication({
      auth: {
        clientId,
        // "common" tillader både personlige Microsoft-konti (fx Outlook.com)
        // og arbejds-/skolekonti — fornuftigt standardvalg for en familieapp.
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
      },
      cache: {
        // sessionStorage (ikke localStorage) — ryddes når fanen/vinduet
        // lukkes, i modsætning til en langtidsholdbar tokenlagring.
        cacheLocation: "sessionStorage",
      },
    });
    await instance.initialize();
    return instance;
  })();

  return msalInstancePromise;
}

/**
 * Holder kun et kortlivet Microsoft-adgangstoken i hukommelsen, samme
 * sikkerhedsprincip som GoogleCalendarSession. MSAL's egen cache
 * (sessionStorage) bruges udelukkende til at kunne genoprette forbindelsen
 * stille inden for samme browser-session (se attemptSilentReconnect) — i
 * modsætning til Google, som tjekker en reel, langtidsholdbar session hos
 * Google selv og derfor virker på tværs af helt nye faner/genindlæsninger.
 * Denne forskel er en bevidst tilpasning til MSAL's arkitektur (se ADR-016),
 * ikke en fejl.
 */
export class OutlookCalendarSession {
  private accessToken: string | null = null;

  isConfigured(): boolean {
    return getOutlookCalendarConfig().enabled;
  }

  getConfigurationError(): string | undefined {
    return getOutlookCalendarConfig().configurationError;
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
    const config = getOutlookCalendarConfig();

    if (!config.enabled || !config.clientId) {
      throw new CalendarProviderError(
        "unavailable",
        "Outlook Kalender er ikke konfigureret.",
      );
    }

    let msalInstance: PublicClientApplication;

    try {
      msalInstance = await getMsalInstance(config.clientId);
    } catch (error: unknown) {
      throw new CalendarProviderError(
        "unavailable",
        "Outlook Kalender kunne ikke startes.",
        { cause: error },
      );
    }

    try {
      const result = await msalInstance.loginPopup({
        scopes: outlookCalendarScopes,
      });

      if (!result.accessToken || !result.account) {
        throw new CalendarProviderError(
          "authentication",
          "Outlook Kalender blev ikke forbundet.",
        );
      }

      msalInstance.setActiveAccount(result.account);
      this.accessToken = result.accessToken;
      markWasConnected();
    } catch (error: unknown) {
      if (error instanceof CalendarProviderError) throw error;
      throw new CalendarProviderError(
        "authentication",
        "Outlook Kalender blev ikke forbundet.",
        { cause: error },
      );
    }
  }

  /**
   * Mirror af GoogleCalendarSession.attemptSilentReconnect — se class-doc
   * ovenfor for forskellen i, hvor pålidelig denne er på tværs af sessioner.
   */
  async attemptSilentReconnect(): Promise<boolean> {
    const config = getOutlookCalendarConfig();

    if (!config.enabled || !config.clientId) {
      return false;
    }

    let msalInstance: PublicClientApplication;

    try {
      msalInstance = await getMsalInstance(config.clientId);
    } catch {
      return false;
    }

    const account = msalInstance.getAllAccounts()[0];

    if (!account) {
      return false;
    }

    const attempt = (async (): Promise<boolean> => {
      try {
        const result = await msalInstance.acquireTokenSilent({
          scopes: outlookCalendarScopes,
          account,
        });

        if (!result.accessToken) {
          return false;
        }

        this.accessToken = result.accessToken;
        markWasConnected();
        return true;
      } catch {
        return false;
      }
    })();

    return raceWithTimeout(attempt, silentReconnectTimeoutMs, false);
  }

  disconnect(): void {
    this.accessToken = null;
    clearWasConnected();

    if (msalInstancePromise) {
      void msalInstancePromise.then((instance) => {
        instance.setActiveAccount(null);
      });
    }
  }
}
