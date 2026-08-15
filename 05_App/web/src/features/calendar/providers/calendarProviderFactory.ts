import type {
  CalendarSource,
} from "../models/calendarProvider";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";
import type { ExternalCalendarProvider } from "./CompositeCalendarProvider";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";
import { decodeGoogleCalendarSourceId } from "./google/googleCalendarIds";
import { OutlookCalendarProvider } from "./outlook/OutlookCalendarProvider";
import { decodeOutlookCalendarSourceId } from "./outlook/outlookCalendarIds";
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
 *
 * Fase 5: intet lokalt fallback-lag længere (ADR-017) — Google er altid til
 * stede i `externalProviders` (uafhængigt af forbindelsesstatus, se noten
 * ovenfor), så denne liste er aldrig tom i praksis.
 */
export const calendarProvider =
  new CompositeCalendarProvider({
    external: externalProviders,
  });

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

export interface MappableCalendarOption {
  // Det rå provider-kalender-id (ikke det kodede sourceId) — samme form som
  // calendarMemberMappingStorage.ts gemmer, så et valg her kan skrives
  // direkte uden yderligere oversættelse.
  rawCalendarId: string;
  label: string;
}

/**
 * Alle kalendere fra alle forbundne konti, i den form
 * kalender-til-familiemedlem-tildelingen (FamilyMemberDialog, ADR-014)
 * har brug for — delt så både dialogen og familielisten i Indstillinger kan
 * slå et rå kalender-id op til et menneskeligt navn.
 */
export async function listAllMappableCalendars(): Promise<
  MappableCalendarOption[]
> {
  const [googleCalendars, outlookCalendars] = await Promise.all([
    listAllGoogleCalendars(),
    listAllOutlookCalendars(),
  ]);

  const options: MappableCalendarOption[] = [];

  for (const source of [...googleCalendars, ...outlookCalendars]) {
    try {
      if (source.providerType === "google") {
        options.push({
          rawCalendarId: decodeGoogleCalendarSourceId(source.id),
          label: `${source.name} (Google)`,
        });
      } else if (source.providerType === "outlook") {
        options.push({
          rawCalendarId: decodeOutlookCalendarSourceId(source.id),
          label: `${source.name} (Outlook)`,
        });
      }
    } catch {
      // En kilde med et uventet id-format springes over — bør ikke ske i
      // praksis, da id'et altid kommer fra samme providers egen encode-fn.
    }
  }

  return options;
}
