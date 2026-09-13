import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { CalendarEventRange, CalendarSource } from "../../models/calendarProvider";
import type { CalendarProvider } from "../CalendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { CalendarProviderErrorCode } from "../calendarProviderErrors";
import {
  createIcloudCalendarEvent,
  deleteIcloudCalendarEvent,
  getIcloudCalendarEvents,
  getIcloudCalendars,
  getIcloudConnections,
  getMyFamily,
  updateIcloudCalendarEvent,
  type IcloudConnectionDto,
} from "../../../family/familyApi";
import {
  getCalendarMemberMappings,
  getMappedOwnersByCalendarId,
  refreshCalendarMemberMappingsFromServer,
} from "../../preferences/calendarMemberMappingStorage";
import { getFamilyMembers } from "../../preferences/familyMembersStorage";
import { getExcludedIcloudCalendarSourceIds } from "./icloudCalendarExclusionStorage";
import {
  decodeIcloudCalendarSourceId,
  decodeIcloudEventId,
  encodeIcloudCalendarSourceId,
} from "./icloudCalendarIds";
import { mapIcloudCalendarEvent, mapIcloudCalendarSource } from "./icloudCalendarMapper";

// Sprint 47: iCloud-kalender via CalDAV. I modsætning til Outlook (der taler
// direkte med Graph fra browseren, se OutlookCalendarSession.ts) skal
// iCloud følge Googles arkitektur — den app-specifikke adgangskode kan aldrig
// leve i browseren, og caldav.icloud.com understøtter alligevel ikke
// cross-origin-kald. Denne provider kalder derfor kun appens egen server
// (familyApi.ts), som selv proxyer til iCloud (icloudConnections.ts).
//
// Flere familiemedlemmer forbinder hver deres egen iCloud-konto (Nicolajs
// beslutning). Sprint 48 ensrettede ejerskabet med Google/Outlook: hver
// KALENDER kobles til et familiemedlem via calendar_member_mappings
// (nøglet på kalenderens rå CalDAV-URL), i stedet for at hele forbindelsen
// (og dermed alle dens kalendere) automatisk arvede ét medlem fra
// forbindelsens egen family_member_id.
export class IcloudCalendarProvider implements CalendarProvider {
  private familyId: string | null = null;

  async getCalendars(): Promise<CalendarSource[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    await refreshCalendarMemberMappingsFromServer();
    const connections = await this.listConnections(familyId);
    const mappedOwnersByCalendarId = getMappedOwnersByCalendarId(getFamilyMembers());
    const excludedIds = new Set(getExcludedIcloudCalendarSourceIds());

    const sourcesByConnection = await Promise.all(
      connections.map(async (connection) => {
        try {
          const calendarsResult = await getIcloudCalendars(familyId, connection.id);
          if (!calendarsResult.ok) return [];

          return (calendarsResult.data.calendars ?? [])
            .filter(
              (calendar) => !excludedIds.has(encodeIcloudCalendarSourceId(connection.id, calendar.url)),
            )
            .map((calendar) =>
              mapIcloudCalendarSource(
                connection.id,
                calendar,
                mappedOwnersByCalendarId.get(calendar.url),
              ),
            );
        } catch {
          // Isolerer fejl pr. forbindelse — én konto med udløbet adgangskode
          // må ikke skjule familiens øvrige iCloud-/Google-/Outlook-kalendere.
          return [];
        }
      }),
    );

    return sourcesByConnection.flat();
  }

  /**
   * Alle kalendere fra ALLE iCloud-forbindelser, uanset eksklusionsvalg —
   * mirror af GoogleCalendarProvider.listAllCalendars(), brugt af
   * listAllMappableCalendars() (calendarProviderFactory.ts) til at fylde
   * "Kalender"-dropdown'en under "Rediger familiemedlem".
   */
  async listAllCalendars(): Promise<CalendarSource[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    const connections = await this.listConnections(familyId);

    const sourcesByConnection = await Promise.all(
      connections.map(async (connection) => {
        try {
          const calendarsResult = await getIcloudCalendars(familyId, connection.id);
          if (!calendarsResult.ok) return [];

          return (calendarsResult.data.calendars ?? []).map((calendar) =>
            mapIcloudCalendarSource(connection.id, calendar),
          );
        } catch {
          return [];
        }
      }),
    );

    return sourcesByConnection.flat();
  }

  async getEvents(range: CalendarEventRange): Promise<CalendarEvent[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    await refreshCalendarMemberMappingsFromServer();
    const connections = await this.listConnections(familyId);
    const mappings = getCalendarMemberMappings();

    const eventsByConnection = await Promise.all(
      connections.map(async (connection) => {
        try {
          return await this.fetchConnectionEvents(familyId, connection, range, mappings);
        } catch {
          return [];
        }
      }),
    );

    return eventsByConnection.flat();
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    if (!input.sourceId) throw new CalendarProviderError("validation", "Vælg en iCloud-kalender.");
    const { connectionId, calendarUrl } = decodeIcloudCalendarSourceId(input.sourceId);
    const familyId = await this.resolveFamilyId();
    if (!familyId) throw new CalendarProviderError("unavailable", "Ingen familie fundet.");

    const result = await createIcloudCalendarEvent(familyId, connectionId, {
      calendarUrl,
      title: input.title,
      start: input.start,
      end: input.end,
      description: input.description,
      location: input.location,
    });

    if (!result.ok || !result.data.uid || !result.data.href) {
      throw new CalendarProviderError(
        toIcloudErrorCode(result.status),
        result.data.error ?? "Kunne ikke oprette aftalen i iCloud.",
      );
    }

    const ownerId = await this.resolveOwnerIdForCalendar(calendarUrl);
    return mapIcloudCalendarEvent(
      connectionId,
      calendarUrl,
      {
        href: result.data.href,
        etag: result.data.etag ?? null,
        uid: result.data.uid,
        title: input.title,
        start: input.start,
        end: input.end,
        allDay: input.allDay,
        description: input.description,
        location: input.location,
      },
      ownerId,
    );
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (event.source !== "apple") {
      throw new CalendarProviderError("validation", "Aftalen er ikke en iCloud-aftale.");
    }

    const { connectionId, calendarUrl, uid, etag } = decodeIcloudEventId(event.id);
    if (!etag) {
      throw new CalendarProviderError(
        "conflict",
        "Aftalen skal genindlæses, før den kan gemmes (mangler versionsmærke).",
      );
    }

    const familyId = await this.resolveFamilyId();
    if (!familyId) throw new CalendarProviderError("unavailable", "Ingen familie fundet.");

    const result = await updateIcloudCalendarEvent(familyId, connectionId, {
      calendarUrl,
      uid,
      title: event.title,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      etag,
    });

    if (!result.ok || !result.data.href) {
      throw new CalendarProviderError(
        toIcloudErrorCode(result.status),
        result.data.error ?? "Kunne ikke opdatere aftalen i iCloud.",
      );
    }

    const ownerId = await this.resolveOwnerIdForCalendar(calendarUrl);
    return mapIcloudCalendarEvent(
      connectionId,
      calendarUrl,
      {
        href: result.data.href,
        etag: result.data.etag ?? null,
        uid,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        description: event.description,
        location: event.location,
      },
      ownerId,
    );
  }

  async deleteEvent(eventId: string, sourceId?: string): Promise<void> {
    void sourceId;
    const { connectionId, calendarUrl, href, etag } = decodeIcloudEventId(eventId);
    if (!etag) {
      throw new CalendarProviderError(
        "conflict",
        "Aftalen skal genindlæses, før den kan slettes (mangler versionsmærke).",
      );
    }

    const familyId = await this.resolveFamilyId();
    if (!familyId) throw new CalendarProviderError("unavailable", "Ingen familie fundet.");

    void calendarUrl;
    const result = await deleteIcloudCalendarEvent(familyId, connectionId, { eventHref: href, etag });

    if (!result.ok) {
      throw new CalendarProviderError(
        toIcloudErrorCode(result.status),
        result.data.error ?? "Kunne ikke slette aftalen i iCloud.",
      );
    }
  }

  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> {
    void event;
    throw new CalendarProviderError(
      "authorization",
      "Gendan er ikke understøttet for iCloud-kalendere.",
    );
  }

  private async resolveFamilyId(): Promise<string | null> {
    if (this.familyId) return this.familyId;
    const result = await getMyFamily();
    this.familyId = result.ok && result.data.family ? result.data.family.id : null;
    return this.familyId;
  }

  private async listConnections(familyId: string): Promise<IcloudConnectionDto[]> {
    const result = await getIcloudConnections(familyId);
    return result.ok ? (result.data.connections ?? []) : [];
  }

  private async resolveOwnerIdForCalendar(calendarUrl: string): Promise<CalendarOwnerId | undefined> {
    await refreshCalendarMemberMappingsFromServer();
    return getCalendarMemberMappings()[calendarUrl];
  }

  private async fetchConnectionEvents(
    familyId: string,
    connection: IcloudConnectionDto,
    range: CalendarEventRange,
    mappings: Record<string, CalendarOwnerId>,
  ): Promise<CalendarEvent[]> {
    const calendarsResult = await getIcloudCalendars(familyId, connection.id);
    if (!calendarsResult.ok) return [];

    const excludedIds = new Set(getExcludedIcloudCalendarSourceIds());
    // Springer en fravalgt kalender helt over — intet REPORT-kald mod iCloud
    // for den, i modsætning til den almindelige "Vis kalendere"-skjuling
    // (calendarSourceVisibilityStorage), som stadig henter, men blot
    // filtrerer selve visningen af en kalender, der allerede er hentet.
    const calendars = (calendarsResult.data.calendars ?? []).filter(
      (calendar) => !excludedIds.has(encodeIcloudCalendarSourceId(connection.id, calendar.url)),
    );

    const eventsByCalendar = await Promise.all(
      calendars.map(async (calendar) => {
        try {
          const eventsResult = await getIcloudCalendarEvents(
            familyId,
            connection.id,
            calendar.url,
            range,
          );
          if (!eventsResult.ok) return [];

          return (eventsResult.data.events ?? []).map((event) =>
            mapIcloudCalendarEvent(connection.id, calendar.url, event, mappings[calendar.url]),
          );
        } catch {
          // Isolerer fejl pr. kalender — samme princip som pr. forbindelse
          // ovenfor.
          return [];
        }
      }),
    );

    return eventsByCalendar.flat();
  }
}

function toIcloudErrorCode(status: number): CalendarProviderErrorCode {
  if (status === 400) return "validation";
  if (status === 401) return "authentication";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 502 || status === 504) return "network";
  return "unknown";
}
