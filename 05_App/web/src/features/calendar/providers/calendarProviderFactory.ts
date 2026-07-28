import type {
  CalendarProviderType,
} from "../models/calendarProvider";
import type { CalendarProvider } from "./CalendarProvider";
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

/**
 * Appens aktuelle provider vælges ét sted. Hooks kan stadig få en provider
 * som argument i tests uden at bruge global state eller React Context.
 */
export const calendarProvider =
  createCalendarProvider("local");
