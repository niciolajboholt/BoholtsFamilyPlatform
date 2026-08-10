import type {
  CalendarEventRange,
} from "../../models/calendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import type {
  GoogleCalendarEvent,
  GoogleCalendarListEntry,
  GoogleCalendarEventsResponse,
  GoogleCalendarListResponse,
} from "./googleCalendarTypes";
import type { GoogleCalendarEventRequest } from "./googleCalendarTypes";

// Fase 3: går gennem serverens eget proxy-lag (server/routes/calendar.ts) i
// stedet for direkte til Google — serveren har adgangstokenet (cookie-
// session), klienten har det aldrig. "credentials: same-origin" sikrer
// sessionscookien følger med, ligesom resten af appens /api-kald.
const calendarApiBaseUrl = "/api/calendar";

function toProviderError(response: Response): CalendarProviderError {
  if (response.status === 401) {
    return new CalendarProviderError(
      "authentication",
      "Google Kalender skal forbindes igen.",
    );
  }

  if (response.status === 403) {
    return new CalendarProviderError(
      "authorization",
      "Google Kalender mangler adgang til denne handling. Forbind kalenderen igen med skriveadgang.",
    );
  }

  if (response.status === 400) return new CalendarProviderError("validation", "Google Kalender afviste aftalens data.");
  if (response.status === 404 || response.status === 410) return new CalendarProviderError("not-found", "Aftalen findes ikke længere i Google Kalender. Opdatér kalenderen og prøv igen.");
  if (response.status === 409 || response.status === 412) return new CalendarProviderError("conflict", "Aftalen blev ændret et andet sted. Opdatér kalenderen, før du gemmer igen.");
  if (response.status === 429) return new CalendarProviderError("unavailable", "Google Kalender modtager for mange forespørgsler. Prøv igen om lidt.");

  return new CalendarProviderError(
    "network",
    "Google Kalender kunne ikke indlæses.",
  );
}

export class GoogleCalendarApi {
  async listCalendars(): Promise<GoogleCalendarListEntry[]> {
    return this.fetchAllPages<GoogleCalendarListResponse>("/calendars");
  }

  async listEvents(
    calendarId: string,
    range: CalendarEventRange,
  ): Promise<GoogleCalendarEvent[]> {
    return this.fetchAllPages<GoogleCalendarEventsResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        timeMin: range.start,
        timeMax: range.end,
        singleEvents: "true",
        orderBy: "startTime",
      },
    );
  }

  createEvent(calendarId: string, request: GoogleCalendarEventRequest): Promise<GoogleCalendarEvent> {
    return this.writeEvent("POST", calendarId, undefined, request);
  }

  updateEvent(calendarId: string, eventId: string, request: GoogleCalendarEventRequest): Promise<GoogleCalendarEvent> {
    return this.writeEvent("PATCH", calendarId, eventId, request);
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.request(
      "DELETE",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      undefined,
      { sendUpdates: "none" },
    );
  }

  private async writeEvent(method: "POST" | "PATCH", calendarId: string, eventId: string | undefined, request: GoogleCalendarEventRequest): Promise<GoogleCalendarEvent> {
    const path = eventId
      ? `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
      : `/calendars/${encodeURIComponent(calendarId)}/events`;
    const response = await this.request(method, path, request, { sendUpdates: "none" });
    try {
      return await response.json() as GoogleCalendarEvent;
    } catch (error: unknown) {
      throw new CalendarProviderError("unknown", "Google Kalender sendte et ugyldigt svar.", { cause: error });
    }
  }

  private async request(method: "POST" | "PATCH" | "DELETE", path: string, body: GoogleCalendarEventRequest | undefined, query: Record<string, string>): Promise<Response> {
    const response = await fetch(`${calendarApiBaseUrl}${path}?${new URLSearchParams(query).toString()}`, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).catch((error: unknown) => { throw new CalendarProviderError("network", "Google Kalender kunne ikke kontaktes. Dine lokale aftaler er ikke påvirket.", { cause: error }); });
    if (!response.ok) throw toProviderError(response);
    return response;
  }

  private async fetchAllPages<
    TResponse extends {
      items?: TItem[];
      nextPageToken?: string;
    },
    TItem = NonNullable<TResponse["items"]>[number],
  >(
    path: string,
    query: Record<string, string> = {},
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let pageToken: string | undefined;

    do {
      const searchParams = new URLSearchParams(query);
      if (pageToken) {
        searchParams.set("pageToken", pageToken);
      }

      let response: Response;
      try {
        response = await fetch(
          `${calendarApiBaseUrl}${path}?${searchParams.toString()}`,
          { credentials: "same-origin" },
        );
      } catch (error: unknown) {
        throw new CalendarProviderError(
          "network",
          "Google Kalender kunne ikke indlæses.",
          { cause: error },
        );
      }

      if (!response.ok) {
        throw toProviderError(response);
      }

      const payload = await response.json() as TResponse;
      items.push(...(payload.items ?? []));
      pageToken = payload.nextPageToken;
    } while (pageToken);

    return items;
  }
}
