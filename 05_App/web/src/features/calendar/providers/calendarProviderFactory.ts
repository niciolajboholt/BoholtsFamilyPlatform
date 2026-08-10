import type {
  CalendarProviderType,
  CalendarSource,
} from "../models/calendarProvider";
import type { CalendarProvider } from "./CalendarProvider";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";
import type { ExternalCalendarProvider } from "./CompositeCalendarProvider";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";
import { OutlookCalendarProvider } from "./outlook/OutlookCalendarProvider";
import { getOutlookCalendarConfig } from "./outlook/outlookCalendarConfig";
import { OutlookCalendarSession } from "./outlook/OutlookCalendarSession";

export const outlookCalendarSession =
  new OutlookCalendarSession();

// Skal køre med det samme dette modul indlæses (app-opstart), ikke først når
// SettingsPage/CalendarPage måtte blive monteret — Outlook bruger en fuld
// side-omdirigering til login (se ADR-016), og Microsoft sender brugeren
// tilbage til appens forside, ikke nødvendigvis Indstillinger. Uden dette
// tidlige kald ville en efterfølgende klient-side-navigation nå at rydde
// URL'ens hash-fragment, før noget nogensinde læste login-svaret i den.
void outlookCalendarSession.ensureInitialized();

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

// Fase 3: Google er ikke længere valgfrit konfigureret via en klient
// env-var — enhver logget-ind bruger har allerede givet kalender-samtykke
// ved login (Fase 1), så providerens egen "authentication"-fejl (401 fra
// /api/calendar, hvis brugeren mod forventning ikke er forbundet) er
// tilstrækkelig; CompositeCalendarProvider fanger den allerede og viser
// providerId "google" som "disconnected" i stedet for at fejle hele siden.
const googleCalendarProvider = new GoogleCalendarProvider();

const outlookCalendarProvider =
  getOutlookCalendarConfig().enabled
    ? new OutlookCalendarProvider(outlookCalendarSession)
    : null;

const externalProviders: ExternalCalendarProvider[] = [
  {
    providerId: "google" as const,
    provider: googleCalendarProvider,
    sourceIdPrefix: "google:",
  },
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
  return googleCalendarProvider.listAllCalendars();
}

/**
 * Mirror af listAllGoogleCalendars, for Outlook.
 */
export function listAllOutlookCalendars(): Promise<CalendarSource[]> {
  return outlookCalendarProvider
    ? outlookCalendarProvider.listAllCalendars()
    : Promise.resolve([]);
}
