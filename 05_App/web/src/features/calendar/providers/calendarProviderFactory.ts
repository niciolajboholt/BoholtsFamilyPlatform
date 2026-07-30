import type {
  CalendarProviderType,
  CalendarSource,
} from "../models/calendarProvider";
import type { CalendarProvider } from "./CalendarProvider";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";
import { getGoogleCalendarConfig } from "./google/googleCalendarConfig";
import { GoogleCalendarSession } from "./google/GoogleCalendarSession";

export const googleCalendarSession =
  new GoogleCalendarSession();
import { LocalCalendarProvider } from "./LocalCalendarProvider";

export function createCalendarProvider(
  providerType: CalendarProviderType,
): CalendarProvider {
  switch (providerType) {
    case "local":
      return new LocalCalendarProvider();
    case "google":
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

/**
 * Appens aktuelle provider vælges ét sted. Hooks kan stadig få en provider
 * som argument i tests uden at bruge global state eller React Context.
 */
export const calendarProvider =
  (() => {
    const localProvider = createCalendarProvider("local");

    if (!googleCalendarProvider) {
      return localProvider;
    }

    return new CompositeCalendarProvider({
      local: localProvider,
      google: googleCalendarProvider,
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
