import type { CalendarEvent } from "../../models/calendarEvent";
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

export class GoogleCalendarProvider implements CalendarProvider {
  private readonly api: GoogleCalendarApi;

  constructor(
    session: GoogleCalendarSession,
  ) {
    this.api = new GoogleCalendarApi(
      () => session.getAccessToken(),
    );
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();

    return calendars
      .map(mapGoogleCalendarSource)
      .filter((source): source is CalendarSource => source !== null);
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const calendars = await this.api.listCalendars();
    const eventsByCalendar = await Promise.all(
      calendars
        .filter((calendar) => Boolean(calendar.id))
        .map(async (calendar) => {
          const calendarId = calendar.id!;
          const events = await this.api.listEvents(
            calendarId,
            range,
          );

          return events
            .map((event) =>
              mapGoogleCalendarEvent(calendarId, event),
            )
            .filter(
              (event): event is CalendarEvent =>
                event !== null,
            );
        }),
    );

    return eventsByCalendar.flat();
  }
  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> { void input; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }
  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> { void event; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }
  async deleteEvent(eventId: string): Promise<void> { void eventId; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }
  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> { void event; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }
}
