import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { CalendarEventRange, CalendarSource } from "../../models/calendarProvider";
import type { CalendarProvider } from "../CalendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import { GoogleCalendarApi } from "./GoogleCalendarApi";
import { GoogleCalendarSession } from "./GoogleCalendarSession";
import {
  mapGoogleCalendarEvent,
  mapGoogleCalendarSource,
} from "./googleCalendarMapper";
import { decodeGoogleEventId, decodeGoogleCalendarSourceId } from "./googleCalendarIds";
import { mapGoogleEventWriteRequest } from "./googleCalendarWriteMapper";
import { getExcludedGoogleCalendarIds } from "../../preferences/googleCalendarExclusionStorage";
import { getCalendarMemberMappings } from "../../preferences/calendarMemberMappingStorage";
import { getFamilyMembers } from "../../preferences/familyMembersStorage";

function getMappedOwnersByCalendarId(): Map<string, CalendarOwner> {
  const mappings = getCalendarMemberMappings();
  const membersById = new Map(getFamilyMembers().map((member) => [member.id, member]));
  const result = new Map<string, CalendarOwner>();

  for (const [calendarId, ownerId] of Object.entries(mappings)) {
    const member = membersById.get(ownerId);
    if (member) result.set(calendarId, member);
  }

  return result;
}

export class GoogleCalendarProvider implements CalendarProvider {
  private readonly api: GoogleCalendarApi;
  private calendarSources: CalendarSource[] = [];

  constructor(
    session: GoogleCalendarSession,
  ) {
    this.api = new GoogleCalendarApi(
      () => session.getAccessToken(),
    );
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();
    const excludedIds = new Set(getExcludedGoogleCalendarIds());
    const mappedOwnersByCalendarId = getMappedOwnersByCalendarId();

    const sources = calendars
      .filter((calendar) => !calendar.id || !excludedIds.has(calendar.id))
      .map((calendar) =>
        mapGoogleCalendarSource(
          calendar,
          calendar.id ? mappedOwnersByCalendarId.get(calendar.id) : undefined,
        ),
      )
      .filter((source): source is CalendarSource => source !== null);
    this.calendarSources = sources;
    return sources;
  }

  /**
   * Ligesom getCalendars(), men uden eksklusionsfiltrering — brugt af
   * "Vælg Google-kalendere"-dialogen, som skal kunne vise og fravælge/
   * genvælge ALLE kalendere, også dem der allerede er ekskluderet fra en
   * tidligere runde. getCalendars() må fortsat filtrere, da den bruges til
   * den faktiske kalendervisning i resten af appen.
   */
  async listAllCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();

    return calendars
      .map((calendar) => mapGoogleCalendarSource(calendar))
      .filter((source): source is CalendarSource => source !== null);
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const calendars = await this.api.listCalendars();
    const excludedIds = new Set(getExcludedGoogleCalendarIds());
    const mappings = getCalendarMemberMappings();
    const eventsByCalendar = await Promise.all(
      calendars
        .filter((calendar) => Boolean(calendar.id) && !excludedIds.has(calendar.id!))
        .map(async (calendar) => {
          const calendarId = calendar.id!;
          const events = await this.api.listEvents(
            calendarId,
            range,
          );
          const mappedOwnerId: CalendarOwnerId | undefined = mappings[calendarId];

          return events
            .map((event) =>
              mapGoogleCalendarEvent(calendarId, event, mappedOwnerId),
            )
            .filter(
              (event): event is CalendarEvent =>
                event !== null,
            );
        }),
    );

    return eventsByCalendar.flat();
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const sourceId = input.sourceId;
    if (!sourceId) throw new CalendarProviderError("validation", "Vælg en Google-kalender.");
    const calendarId = decodeGoogleCalendarSourceId(sourceId);
    await this.assertWritableSource(sourceId);
    const created = await this.api.createEvent(calendarId, mapGoogleEventWriteRequest(input));
    return this.mapWrittenEvent(calendarId, created);
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (event.source !== "google") throw new CalendarProviderError("validation", "Aftalen er ikke en Google-aftale.");
    await this.assertWritableSource(event.sourceId);
    const { calendarId, eventId } = decodeGoogleEventId(event.id);
    if (calendarId !== decodeGoogleCalendarSourceId(event.sourceId)) throw new CalendarProviderError("validation", "Google-aftalen tilhører en anden kalender.");
    const updated = await this.api.updateEvent(calendarId, eventId, mapGoogleEventWriteRequest(event));
    return this.mapWrittenEvent(calendarId, updated);
  }

  async deleteEvent(eventId: string, sourceId?: string): Promise<void> {
    if (!sourceId) throw new CalendarProviderError("validation", "Google-kalender mangler.");
    await this.assertWritableSource(sourceId);
    const { calendarId, eventId: googleEventId } = decodeGoogleEventId(eventId);
    if (calendarId !== decodeGoogleCalendarSourceId(sourceId)) throw new CalendarProviderError("validation", "Google-aftalen tilhører en anden kalender.");
    await this.api.deleteEvent(calendarId, googleEventId);
  }
  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> { void event; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }

  private async assertWritableSource(sourceId: string): Promise<void> {
    const sources = this.calendarSources.length > 0
      ? this.calendarSources
      : await this.getCalendars();
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new CalendarProviderError("not-found", "Google-kalenderen findes ikke længere.");
    if (source.isReadOnly) throw new CalendarProviderError("authorization", "Denne Google-kalender er skrivebeskyttet.");
  }

  private mapWrittenEvent(calendarId: string, event: import("./googleCalendarTypes").GoogleCalendarEvent): CalendarEvent {
    const mappedOwnerId: CalendarOwnerId | undefined = getCalendarMemberMappings()[calendarId];
    const mapped = mapGoogleCalendarEvent(calendarId, event, mappedOwnerId);
    if (!mapped) throw new CalendarProviderError("unknown", "Google Kalender sendte en ugyldig aftale.");
    return mapped;
  }
}
