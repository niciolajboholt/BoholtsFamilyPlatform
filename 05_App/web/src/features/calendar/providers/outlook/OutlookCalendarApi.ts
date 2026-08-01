import type {
  CalendarEventRange,
} from "../../models/calendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import type {
  OutlookCalendarEvent,
  OutlookCalendarEventRequest,
  OutlookCalendarEventsResponse,
  OutlookCalendarListEntry,
  OutlookCalendarListResponse,
} from "./outlookCalendarTypes";

const graphApiBaseUrl = "https://graph.microsoft.com/v1.0";

// Beder Graph om at levere alle dateTime-felter i UTC, uanset kontoens egen
// tidszoneindstilling — så outlookCalendarMapper.ts trygt kan tilføje "Z" og
// få et korrekt ISO-tidspunkt, samme som Googles altid-UTC-med-offset-format.
const utcTimezoneHeader = { Prefer: 'outlook.timezone="UTC"' };

function toProviderError(response: Response): CalendarProviderError {
  if (response.status === 401) {
    return new CalendarProviderError(
      "authentication",
      "Outlook Kalender skal forbindes igen.",
    );
  }

  if (response.status === 403) {
    return new CalendarProviderError(
      "authorization",
      "Outlook Kalender mangler adgang til denne handling. Forbind kalenderen igen med skriveadgang.",
    );
  }

  if (response.status === 400) return new CalendarProviderError("validation", "Outlook Kalender afviste aftalens data.");
  if (response.status === 404 || response.status === 410) return new CalendarProviderError("not-found", "Aftalen findes ikke længere i Outlook Kalender. Opdatér kalenderen og prøv igen.");
  if (response.status === 409 || response.status === 412) return new CalendarProviderError("conflict", "Aftalen blev ændret et andet sted. Opdatér kalenderen, før du gemmer igen.");
  if (response.status === 429) return new CalendarProviderError("unavailable", "Outlook Kalender modtager for mange forespørgsler. Prøv igen om lidt.");

  return new CalendarProviderError(
    "network",
    "Outlook Kalender kunne ikke indlæses.",
  );
}

export class OutlookCalendarApi {
  private readonly getAccessToken: () => string | null;

  constructor(
    getAccessToken: () => string | null,
  ) {
    this.getAccessToken = getAccessToken;
  }

  async listCalendars(): Promise<OutlookCalendarListEntry[]> {
    return this.fetchAllPages<OutlookCalendarListResponse>(
      "/me/calendars",
    );
  }

  async listEvents(
    calendarId: string,
    range: CalendarEventRange,
  ): Promise<OutlookCalendarEvent[]> {
    // /calendarView (i modsætning til /events) udfolder selv gentagne serier
    // til enkelte forekomster inden for det angivne tidsvindue — Graphs
    // modstykke til Googles singleEvents: "true".
    return this.fetchAllPages<OutlookCalendarEventsResponse>(
      `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`,
      {
        startDateTime: range.start,
        endDateTime: range.end,
      },
      utcTimezoneHeader,
    );
  }

  createEvent(calendarId: string, request: OutlookCalendarEventRequest): Promise<OutlookCalendarEvent> {
    return this.writeEvent("POST", `/me/calendars/${encodeURIComponent(calendarId)}/events`, request);
  }

  updateEvent(_calendarId: string, eventId: string, request: OutlookCalendarEventRequest): Promise<OutlookCalendarEvent> {
    return this.writeEvent("PATCH", `/me/events/${encodeURIComponent(eventId)}`, request);
  }

  async deleteEvent(_calendarId: string, eventId: string): Promise<void> {
    await this.request("DELETE", `/me/events/${encodeURIComponent(eventId)}`, undefined);
  }

  private async writeEvent(method: "POST" | "PATCH", path: string, request: OutlookCalendarEventRequest): Promise<OutlookCalendarEvent> {
    const response = await this.request(method, path, request);
    try {
      return await response.json() as OutlookCalendarEvent;
    } catch (error: unknown) {
      throw new CalendarProviderError("unknown", "Outlook Kalender sendte et ugyldigt svar.", { cause: error });
    }
  }

  private async request(method: "POST" | "PATCH" | "DELETE", path: string, body: OutlookCalendarEventRequest | undefined): Promise<Response> {
    const accessToken = this.getAccessToken();
    if (!accessToken) throw new CalendarProviderError("authentication", "Outlook Kalender skal forbindes igen, før aftalen kan gemmes.");
    const response = await fetch(`${graphApiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...utcTimezoneHeader,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).catch((error: unknown) => { throw new CalendarProviderError("network", "Outlook Kalender kunne ikke kontaktes. Dine lokale aftaler er ikke påvirket.", { cause: error }); });
    if (!response.ok) throw toProviderError(response);
    return response;
  }

  private async fetchAllPages<
    TResponse extends {
      value?: TItem[];
      "@odata.nextLink"?: string;
    },
    TItem = NonNullable<TResponse["value"]>[number],
  >(
    path: string,
    query: Record<string, string> = {},
    extraHeaders: Record<string, string> = {},
  ): Promise<TItem[]> {
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      throw new CalendarProviderError(
        "authentication",
        "Outlook Kalender er ikke forbundet.",
      );
    }

    const items: TItem[] = [];
    // Graphs paginering leverer en fuld næste-side-URL (i modsætning til
    // Googles pageToken, som skal genindsættes i en ny forespørgsel) — den
    // bruges derfor direkte, uden forespørgselsparametrene igen.
    let url: string | undefined =
      `${graphApiBaseUrl}${path}?${new URLSearchParams(query).toString()}`;

    while (url) {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
        });
      } catch (error: unknown) {
        throw new CalendarProviderError(
          "network",
          "Outlook Kalender kunne ikke indlæses.",
          { cause: error },
        );
      }

      if (!response.ok) {
        throw toProviderError(response);
      }

      const payload = await response.json() as TResponse;
      items.push(...(payload.value ?? []));
      url = payload["@odata.nextLink"];
    }

    return items;
  }
}
