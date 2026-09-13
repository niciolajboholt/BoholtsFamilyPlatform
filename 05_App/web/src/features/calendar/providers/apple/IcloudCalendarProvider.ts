import { familyPseudoMemberId } from "../../models/calendarEvent";
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
  getFamilyMembers,
  getFamilyPseudoMemberServerId,
} from "../../preferences/familyMembersStorage";
import { decodeIcloudCalendarSourceId, decodeIcloudEventId } from "./icloudCalendarIds";
import { mapIcloudCalendarEvent, mapIcloudCalendarSource } from "./icloudCalendarMapper";

// Sprint 47: iCloud-kalender via CalDAV. I modsætning til Outlook (der taler
// direkte med Graph fra browseren, se OutlookCalendarSession.ts) skal
// iCloud følge Googles arkitektur — den app-specifikke adgangskode kan aldrig
// leve i browseren, og caldav.icloud.com understøtter alligevel ikke
// cross-origin-kald. Denne provider kalder derfor kun appens egen server
// (familyApi.ts), som selv proxyer til iCloud (icloudConnections.ts).
//
// Flere familiemedlemmer forbinder hver deres egen iCloud-konto (Nicolajs
// beslutning) — ejerskab kommer direkte fra forbindelsens familyMemberId,
// ikke calendar_member_mappings (som kun Google/Outlook bruger, da de er
// login-baserede énkonto-forbindelser).
export class IcloudCalendarProvider implements CalendarProvider {
  private familyId: string | null = null;

  async getCalendars(): Promise<CalendarSource[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    const connections = await this.listConnections(familyId);
    const membersById = new Map(getFamilyMembers().map((member) => [member.id, member]));

    const sourcesByConnection = await Promise.all(
      connections.map(async (connection) => {
        try {
          const calendarsResult = await getIcloudCalendars(familyId, connection.id);
          if (!calendarsResult.ok) return [];

          const ownerId = this.toLocalOwnerId(connection.familyMemberId);
          return (calendarsResult.data.calendars ?? []).map((calendar) =>
            mapIcloudCalendarSource(
              connection.id,
              calendar,
              ownerId ? membersById.get(ownerId) : undefined,
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

  async getEvents(range: CalendarEventRange): Promise<CalendarEvent[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    const connections = await this.listConnections(familyId);

    const eventsByConnection = await Promise.all(
      connections.map(async (connection) => {
        try {
          return await this.fetchConnectionEvents(familyId, connection, range);
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

    const ownerId = await this.resolveOwnerIdForConnection(familyId, connectionId);
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

    const ownerId = await this.resolveOwnerIdForConnection(familyId, connectionId);
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

  private async resolveOwnerIdForConnection(
    familyId: string,
    connectionId: string,
  ): Promise<CalendarOwnerId | undefined> {
    const connections = await this.listConnections(familyId);
    const connection = connections.find((entry) => entry.id === connectionId);
    return this.toLocalOwnerId(connection?.familyMemberId ?? null);
  }

  // Mirror af calendarMemberMappingStorage.ts's private toLocalOwnerId —
  // samme regel: kun familie-pseudomedlemmets server-id skal oversættes til
  // det lokale "family", ethvert andet familymember-id er allerede lokalt.
  private toLocalOwnerId(serverMemberId: string | null): CalendarOwnerId | undefined {
    if (!serverMemberId) return undefined;
    if (serverMemberId === getFamilyPseudoMemberServerId()) return familyPseudoMemberId;
    return serverMemberId as CalendarOwnerId;
  }

  private async fetchConnectionEvents(
    familyId: string,
    connection: IcloudConnectionDto,
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const calendarsResult = await getIcloudCalendars(familyId, connection.id);
    if (!calendarsResult.ok) return [];

    const ownerId = this.toLocalOwnerId(connection.familyMemberId);
    const calendars = calendarsResult.data.calendars ?? [];

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
            mapIcloudCalendarEvent(connection.id, calendar.url, event, ownerId),
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
