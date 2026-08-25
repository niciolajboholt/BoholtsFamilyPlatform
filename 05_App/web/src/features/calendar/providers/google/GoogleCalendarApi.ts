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

export interface GoogleCalendarEventsPage {
  events: GoogleCalendarEvent[];
  nextSyncToken?: string;
}

export class GoogleCalendarApi {
  async listCalendars(): Promise<GoogleCalendarListEntry[]> {
    return this.fetchAllPages<GoogleCalendarListResponse>("/calendars");
  }

  // Sprint 25: to hentemåder. Med "range" hentes alt i tidsvinduet (dagens
  // adfærd, bruges ved første synk eller når et syncToken er udløbet).
  // Med "syncToken" sender Google kun ÆNDRINGER siden sidst — Googles API
  // tillader ikke at kombinere syncToken med timeMin/timeMax/singleEvents/
  // orderBy, så de to grene sender helt forskellige forespørgselsparametre.
  async listEvents(
    calendarId: string,
    params: { range: CalendarEventRange } | { syncToken: string },
  ): Promise<GoogleCalendarEventsPage> {
    const query: Record<string, string> =
      "syncToken" in params
        ? { syncToken: params.syncToken }
        : {
            timeMin: params.range.start,
            timeMax: params.range.end,
            singleEvents: "true",
            orderBy: "startTime",
          };

    return this.fetchEventPages(`/calendars/${encodeURIComponent(calendarId)}/events`, query);
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

  // Flytter aftalen til en anden kalender — Googles "move"-handling accepterer
  // kun destinationen, ingen andre feltændringer i samme kald (se
  // GoogleCalendarProvider.updateEvent, som patcher øvrige felter bagefter).
  async moveEvent(
    calendarId: string,
    eventId: string,
    destinationCalendarId: string,
  ): Promise<GoogleCalendarEvent> {
    const response = await this.request(
      "POST",
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/move`,
      undefined,
      { destination: destinationCalendarId, sendUpdates: "none" },
    );

    try {
      return await response.json() as GoogleCalendarEvent;
    } catch (error: unknown) {
      throw new CalendarProviderError("unknown", "Google Kalender sendte et ugyldigt svar.", { cause: error });
    }
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

  // Ligesom fetchAllPages, men bevarer nextSyncToken (kun til stede på
  // svarets sidste side) — fetchAllPages selv kasserer alt undtagen items,
  // og bruges fortsat af listCalendars(), som ikke har brug for et syncToken.
  private async fetchEventPages(
    path: string,
    query: Record<string, string>,
  ): Promise<GoogleCalendarEventsPage> {
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

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

      const payload = await response.json() as GoogleCalendarEventsResponse;
      events.push(...(payload.items ?? []));
      pageToken = payload.nextPageToken;
      nextSyncToken = payload.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { events, nextSyncToken };
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
