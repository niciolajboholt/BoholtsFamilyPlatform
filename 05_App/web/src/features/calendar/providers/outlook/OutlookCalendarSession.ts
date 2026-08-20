import { PublicClientApplication } from "@azure/msal-browser";

import { getOutlookCalendarConfig } from "./outlookCalendarConfig";
import { CalendarProviderError } from "../calendarProviderErrors";
import { raceWithTimeout } from "../raceWithTimeout";

export const outlookCalendarScopes = ["Calendars.ReadWrite"];

const wasConnectedStorageKey = "outlook-calendar-was-connected";

// UI-only hint so the connect button can say "Genforbind" after a reload,
// instead of "Forbind". Never the access token itself, so it carries no
// security implication. Google has no equivalent flag — its connection is
// established once at login (ADR-017) and owned entirely by the server, so
// there is no separate client-side "connect" step to remember.
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

function getMsalInstance(
  clientId: string,
  tenantId: string | undefined,
): Promise<PublicClientApplication> {
  if (msalInstancePromise) {
    return msalInstancePromise;
  }

  msalInstancePromise = (async () => {
    const instance = new PublicClientApplication({
      auth: {
        clientId,
        // "common" tillader personlige Microsoft-konti + enhver organisation
        // — men en "Single tenant only"-app-registrering (fx en arbejds-
        // /skolekonto-app) MÅ ikke bruge /common (Microsoft afviser med
        // AADSTS50194) og skal i stedet bruge sit eget tenant-id her.
        authority: `https://login.microsoftonline.com/${tenantId ?? "common"}`,
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
 * Holder kun et kortlivet Microsoft-adgangstoken i hukommelsen — samme
 * "hold aldrig et langtidsholdbart token i browseren"-princip Google fulgte,
 * før ADR-017 flyttede Googles token server-side helt. MSAL's egen cache
 * (sessionStorage) bruges udelukkende til at kunne genoprette forbindelsen
 * stille inden for samme browser-session (se attemptSilentReconnect) — i
 * modsætning til Google i dag, hvor forbindelsen er en krypteret refresh
 * token ejet af serveren (D1) og derfor virker på tværs af helt nye
 * faner/genindlæsninger uden nogen klient-side reconnect-logik overhovedet.
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
          msalInstance = await getMsalInstance(clientId, config.tenantId);
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
   * Bruger en fuld sideomdirigering til Microsofts logind (ligesom Googles
   * eget server-side OAuth-flow, ADR-017), i stedet for en pop-up — Safari
   * (særligt i en installeret PWA) blokerer ofte kommunikationen tilbage fra
   * en pop-up-baseret login, så den hænger uden nogensinde at svare. En
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
      msalInstance = await getMsalInstance(config.clientId, config.tenantId);
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
   * Genopretter forbindelsen stille inden for samme browser-session, uden at
   * brugeren skal klikke "Forbind" igen — Google har intet ækvivalent behov
   * (se class-doc ovenfor: serveren holder allerede en langtidsholdbar
   * forbindelse, uafhængig af browser-session).
   */
  async attemptSilentReconnect(): Promise<boolean> {
    const config = getOutlookCalendarConfig();

    if (!config.enabled || !config.clientId) {
      return false;
    }

    let msalInstance: PublicClientApplication;

    try {
      msalInstance = await getMsalInstance(config.clientId, config.tenantId);
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

  // Sprint 29: kaldes fra logout — kun setActiveAccount(null) lod MSAL's
  // egen sessionStorage-cache (adgangs-/id-tokens, konto-info) stå
  // tilbage. clearCache() rydder den rent faktisk, uden at navigere væk
  // fra appen (i modsætning til MSAL's logoutRedirect/logoutPopup).
  async disconnect(): Promise<void> {
    this.accessToken = null;
    clearWasConnected();

    if (msalInstancePromise) {
      const instance = await msalInstancePromise;
      instance.setActiveAccount(null);
      await instance.clearCache();
    }
  }
}
