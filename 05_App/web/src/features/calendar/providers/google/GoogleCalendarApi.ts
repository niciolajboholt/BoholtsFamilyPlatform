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

const calendarApiBaseUrl =
  "https://www.googleapis.com/calendar/v3";

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
      "Google Kalender-adgang blev afvist.",
    );
  }

  return new CalendarProviderError(
    "network",
    "Google Kalender kunne ikke indlÃ¦ses.",
  );
}

export class GoogleCalendarApi {
  private readonly getAccessToken: () => string | null;

  constructor(
    getAccessToken: () => string | null,
  ) {
    this.getAccessToken = getAccessToken;
  }

  async listCalendars(): Promise<GoogleCalendarListEntry[]> {
    return this.fetchAllPages<GoogleCalendarListResponse>(
      "/users/me/calendarList",
    );
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
    const accessToken = this.getAccessToken();

    if (!accessToken) {
      throw new CalendarProviderError(
        "authentication",
        "Google Kalender er ikke forbundet.",
      );
    }

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
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } catch (error: unknown) {
        throw new CalendarProviderError(
          "network",
          "Google Kalender kunne ikke indlÃ¦ses.",
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
