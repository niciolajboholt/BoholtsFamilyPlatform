import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { CalendarEventRange, CalendarSource } from "../../models/calendarProvider";
import type { CalendarProvider } from "../CalendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import { OutlookCalendarApi } from "./OutlookCalendarApi";
import { OutlookCalendarSession } from "./OutlookCalendarSession";
import {
  mapOutlookCalendarEvent,
  mapOutlookCalendarSource,
} from "./outlookCalendarMapper";
import { decodeOutlookEventId, decodeOutlookCalendarSourceId } from "./outlookCalendarIds";
import { mapOutlookEventWriteRequest } from "./outlookCalendarWriteMapper";
import { getExcludedOutlookCalendarIds } from "./outlookCalendarExclusionStorage";
import {
  getCalendarMemberMappings,
  getMappedOwnersByCalendarId,
} from "../../preferences/calendarMemberMappingStorage";
import { getFamilyMembers } from "../../preferences/familyMembersStorage";

export class OutlookCalendarProvider implements CalendarProvider {
  private readonly api: OutlookCalendarApi;

  private calendarSources: CalendarSource[] = [];

  constructor(
    session: OutlookCalendarSession,
  ) {
    this.api = new OutlookCalendarApi(
      () => session.getAccessToken(),
    );
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();
    const excludedIds = new Set(getExcludedOutlookCalendarIds());
    const mappedOwnersByCalendarId = getMappedOwnersByCalendarId(getFamilyMembers());

    const sources = calendars
      .filter((calendar) => !calendar.id || !excludedIds.has(calendar.id))
      .map((calendar) =>
        mapOutlookCalendarSource(
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
   * "Vælg Outlook-kalendere"-dialogen, mirror af GoogleCalendarProvider.
   */
  async listAllCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();

    return calendars
      .map((calendar) => mapOutlookCalendarSource(calendar))
      .filter((source): source is CalendarSource => source !== null);
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const calendars = await this.api.listCalendars();
    const excludedIds = new Set(getExcludedOutlookCalendarIds());
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
              mapOutlookCalendarEvent(calendarId, event, mappedOwnerId),
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
    if (!sourceId) throw new CalendarProviderError("validation", "Vælg en Outlook-kalender.");
    const calendarId = decodeOutlookCalendarSourceId(sourceId);
    await this.assertWritableSource(sourceId);
    const created = await this.api.createEvent(calendarId, mapOutlookEventWriteRequest(input));
    return this.mapWrittenEvent(calendarId, created);
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (event.source !== "outlook") throw new CalendarProviderError("validation", "Aftalen er ikke en Outlook-aftale.");
    await this.assertWritableSource(event.sourceId);
    const { calendarId, eventId } = decodeOutlookEventId(event.id);
    if (calendarId !== decodeOutlookCalendarSourceId(event.sourceId)) throw new CalendarProviderError("validation", "Outlook-aftalen tilhører en anden kalender.");
    const updated = await this.api.updateEvent(calendarId, eventId, mapOutlookEventWriteRequest(event));
    return this.mapWrittenEvent(calendarId, updated);
  }

  async deleteEvent(eventId: string, sourceId?: string): Promise<void> {
    if (!sourceId) throw new CalendarProviderError("validation", "Outlook-kalender mangler.");
    await this.assertWritableSource(sourceId);
    const { calendarId, eventId: outlookEventId } = decodeOutlookEventId(eventId);
    if (calendarId !== decodeOutlookCalendarSourceId(sourceId)) throw new CalendarProviderError("validation", "Outlook-aftalen tilhører en anden kalender.");
    await this.api.deleteEvent(calendarId, outlookEventId);
  }
  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> { void event; throw new CalendarProviderError("authorization", "Outlook Kalender er skrivebeskyttet."); }

  private async assertWritableSource(sourceId: string): Promise<void> {
    const sources = this.calendarSources.length > 0
      ? this.calendarSources
      : await this.getCalendars();
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new CalendarProviderError("not-found", "Outlook-kalenderen findes ikke længere.");
    if (source.isReadOnly) throw new CalendarProviderError("authorization", "Denne Outlook-kalender er skrivebeskyttet.");
  }

  private mapWrittenEvent(calendarId: string, event: import("./outlookCalendarTypes").OutlookCalendarEvent): CalendarEvent {
    const mappedOwnerId: CalendarOwnerId | undefined = getCalendarMemberMappings()[calendarId];
    const mapped = mapOutlookCalendarEvent(calendarId, event, mappedOwnerId);
    if (!mapped) throw new CalendarProviderError("unknown", "Outlook Kalender sendte en ugyldig aftale.");
    return mapped;
  }
}
