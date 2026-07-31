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

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const errorCode = (error as { errorCode?: string }).errorCode;
    return errorCode ? `${error.message} (${errorCode})` : error.message;
  }
  return String(error);
}

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

  private initializationPromise: Promise<void> | null = null;

  // Midlertidig fejlsøgnings-oplysning (Sprint 18) — hjælper med at se,
  // hvorfor et redirect-login ikke blev fanget op, uden at skulle ramme det
  // rigtige splitsekund i en skærmoptagelse. Fjernes igen, når Outlook-
  // forbindelsen er verificeret at virke pålideligt.
  private lastRedirectDiagnostic: string | null = null;

  isConfigured(): boolean {
    return getOutlookCalendarConfig().enabled;
  }

  getConfigurationError(): string | undefined {
    return getOutlookCalendarConfig().configurationError;
  }

  getLastRedirectDiagnostic(): string | null {
    return this.lastRedirectDiagnostic;
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

  /**
   * Skal kaldes én gang, tidligt i appens livscyklus (fra
   * useOutlookCalendarConnection ved mount) — behandler et evt. igangværende
   * "kommer tilbage fra Microsofts logind"-svar (se connect()-kommentaren).
   * Uden dette kald ville et gennemført login aldrig blive fanget op.
   */
  async ensureInitialized(): Promise<void> {
    const config = getOutlookCalendarConfig();

    if (!config.enabled || !config.clientId) {
      return;
    }

    if (!this.initializationPromise) {
      const clientId = config.clientId;
      const hadHashOnLoad = window.location.hash.length > 0;

      this.initializationPromise = (async () => {
        let msalInstance: PublicClientApplication;

        try {
          msalInstance = await getMsalInstance(clientId);
        } catch (error: unknown) {
          this.lastRedirectDiagnostic = `MSAL kunne ikke startes: ${describeError(error)}`;
          return;
        }

        try {
          const result = await msalInstance.handleRedirectPromise();

          if (result?.accessToken && result.account) {
            msalInstance.setActiveAccount(result.account);
            this.accessToken = result.accessToken;
            markWasConnected();
            this.lastRedirectDiagnostic = null;
          } else if (hadHashOnLoad) {
            this.lastRedirectDiagnostic =
              "Siden havde et login-svar i adressen, men MSAL afsluttede uden et adgangstoken.";
          }
        } catch (error: unknown) {
          this.lastRedirectDiagnostic = `Login-svaret kunne ikke behandles: ${describeError(error)}`;
        }
      })();
    }

    return this.initializationPromise;
  }

  /**
   * Bruger en fuld sideomdirigering til Microsofts logind, i stedet for en
   * pop-up (som GoogleCalendarSession bruger for Google) — Safari (særligt i
   * en installeret PWA) blokerer ofte kommunikationen tilbage fra en
   * pop-up-baseret login, så den hænger uden nogensinde at svare. En
   * omdirigering navigerer hele siden væk og tilbage i stedet, hvilket er
   * Microsofts egen anbefaling for Safari/mobil. Se ADR-016.
   */
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

    // Navigerer væk fra appen — koden herefter kører kun, hvis omdirigeringen
    // selv fejlede med det samme (fx netværksfejl), ikke efter et gennemført
    // login (det svar behandles af ensureInitialized() ved næste sideindlæsning).
    await msalInstance.loginRedirect({
      scopes: outlookCalendarScopes,
    });
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
