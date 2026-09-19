import type {
  CalendarSource,
} from "../models/calendarProvider";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";
import type { ExternalCalendarProvider } from "./CompositeCalendarProvider";
import { IcloudCalendarProvider } from "./apple/IcloudCalendarProvider";
import { decodeIcloudCalendarSourceId } from "./apple/icloudCalendarIds";
import { GoogleCalendarProvider } from "./google/GoogleCalendarProvider";
import { decodeGoogleCalendarSourceId } from "./google/googleCalendarIds";
import { IcsCalendarProvider } from "./ics/IcsCalendarProvider";
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

// Fase 9: ingen konto at forbinde, så — i modsætning til Google/Outlook —
// altid til stede, uafhængigt af nogen konfiguration; en familie uden
// abonnementer får blot en tom kalenderliste fra den, ligesom Google gør for
// en bruger uden delte kalendere.
const icsCalendarProvider = new IcsCalendarProvider();

// Sprint 47: ligesom ICS ovenfor altid til stede — forbindelserne er
// familiedata (server-CRUD, se familyApi.ts), ikke en enkelt OAuth-session
// som Google/Outlook, så der er intet globalt "er iCloud konfigureret"-tjek.
const icloudCalendarProvider = new IcloudCalendarProvider();

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
  {
    providerId: "apple" as const,
    provider: icloudCalendarProvider,
    sourceIdPrefix: "icloud:",
  },
  {
    providerId: "ics" as const,
    provider: icsCalendarProvider,
    sourceIdPrefix: "ics:",
  },
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

/**
 * Mirror af listAllGoogleCalendars, for iCloud — samler kalendere fra ALLE
 * familiens iCloud-forbindelser, ikke kun én konto (Sprint 47's
 * flere-konti-model).
 */
export function listAllIcloudCalendars(): Promise<CalendarSource[]> {
  return icloudCalendarProvider.listAllCalendars();
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
  // Hver kildes kald fanges for sig selv, IKKE i ét fælles Promise.all —
  // GoogleCalendarProvider.listAllCalendars() (i modsætning til iCloud- og
  // Outlook-varianterne) kaster videre, hvis Google-API-kaldet fejler (fx et
  // udløbet token, der endnu ikke er fornyet). Med et fælles Promise.all
  // ville den ene fejlende kilde tømme HELE listen, inkl. kalendere fra
  // kilder der rent faktisk svarede fint — set i praksis: "Kalender"-
  // dropdown'en i "Rediger familiemedlem" viste kun "Ingen", selvom
  // Google-forbindelsen var aktiv og "Vælg Google-kalendere" viste
  // kalendere fint (den kalder API'et på et andet tidspunkt).
  const [googleCalendars, outlookCalendars, icloudCalendars] = await Promise.all([
    listAllGoogleCalendars().catch(() => []),
    listAllOutlookCalendars().catch(() => []),
    listAllIcloudCalendars().catch(() => []),
  ]);

  const options: MappableCalendarOption[] = [];

  for (const source of [...googleCalendars, ...outlookCalendars, ...icloudCalendars]) {
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
      } else if (source.providerType === "apple") {
        // Nøglet på den rå CalDAV-URL (ikke det kodede sourceId, som også
        // rummer forbindelses-id'et) — matcher hvad
        // IcloudCalendarProvider.ts selv slår op i calendar_member_mappings.
        options.push({
          rawCalendarId: decodeIcloudCalendarSourceId(source.id).calendarUrl,
          label: `${source.name} (iCloud)`,
        });
      }
    } catch {
      // En kilde med et uventet id-format springes over — bør ikke ske i
      // praksis, da id'et altid kommer fra samme providers egen encode-fn.
    }
  }

  return options;
}
