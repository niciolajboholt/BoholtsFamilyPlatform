import type {
  CalendarProviderType,
  CalendarSource,
} from "../models/calendarProvider";
import type { CalendarProvider } from "./CalendarProvider";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";
import type { ExternalCalendarProvider } from "./CompositeCalendarProvider";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";
import { getGoogleCalendarConfig } from "./google/googleCalendarConfig";
import { GoogleCalendarSession } from "./google/GoogleCalendarSession";
import { OutlookCalendarProvider } from "./outlook/OutlookCalendarProvider";
import { getOutlookCalendarConfig } from "./outlook/outlookCalendarConfig";
import { OutlookCalendarSession } from "./outlook/OutlookCalendarSession";

export const googleCalendarSession =
  new GoogleCalendarSession();
export const outlookCalendarSession =
  new OutlookCalendarSession();
import { LocalCalendarProvider } from "./LocalCalendarProvider";

export function createCalendarProvider(
  providerType: CalendarProviderType,
): CalendarProvider {
  switch (providerType) {
    case "local":
      return new LocalCalendarProvider();
    case "google":
    case "outlook":
    case "apple":
      throw new Error(
        `Calendar provider '${providerType}' er ikke implementeret endnu.`,
      );
  }
}

const googleCalendarProvider =
  getGoogleCalendarConfig().enabled
    ? new GoogleCalendarProvider(googleCalendarSession)
    : null;

const outlookCalendarProvider =
  getOutlookCalendarConfig().enabled
    ? new OutlookCalendarProvider(outlookCalendarSession)
    : null;

const externalProviders: ExternalCalendarProvider[] = [
  ...(googleCalendarProvider
    ? [{
        providerId: "google" as const,
        provider: googleCalendarProvider,
        sourceIdPrefix: "google:",
      }]
    : []),
  ...(outlookCalendarProvider
    ? [{
        providerId: "outlook" as const,
        provider: outlookCalendarProvider,
        sourceIdPrefix: "outlook:",
      }]
    : []),
];

/**
 * Appens aktuelle provider vælges ét sted. Hooks kan stadig få en provider
 * som argument i tests uden at bruge global state eller React Context.
 */
export const calendarProvider =
  (() => {
    const localProvider = createCalendarProvider("local");

    if (externalProviders.length === 0) {
      return localProvider;
    }

    return new CompositeCalendarProvider({
      local: localProvider,
      external: externalProviders,
    });
  })();

/**
 * Henter ALLE Google-kalendere, uanset eksklusionsvalg — bruges kun af
 * "Vælg Google-kalendere"-dialogen (se GoogleCalendarProvider.listAllCalendars).
 * Almindelig kalenderdata skal fortsat gå gennem `calendarProvider`, som
 * respekterer eksklusion.
 */
export function listAllGoogleCalendars(): Promise<CalendarSource[]> {
  return googleCalendarProvider
    ? googleCalendarProvider.listAllCalendars()
    : Promise.resolve([]);
}

/**
 * Mirror af listAllGoogleCalendars, for Outlook.
 */
export function listAllOutlookCalendars(): Promise<CalendarSource[]> {
  return outlookCalendarProvider
    ? outlookCalendarProvider.listAllCalendars()
    : Promise.resolve([]);
}
