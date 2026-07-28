import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type {
  CalendarEventRange,
  CalendarSource,
} from "../models/calendarProvider";
import type { CalendarProviderHealth } from "../models/calendarProviderHealth";
import type { CalendarProvider } from "./CalendarProvider";
import { CalendarProviderError } from "./calendarProviderErrors";

interface CompositeCalendarProviders {
  local: CalendarProvider;
  google?: CalendarProvider;
}

/**
 * Samler uafhængige kalenderkilder, uden at React-laget behøver kende deres
 * konkrete implementeringer. En fejl i en valgfri ekstern kilde må ikke skjule
 * familiens lokale aftaler.
 */
export class CompositeCalendarProvider
  implements CalendarProvider
{
  private readonly providers: CompositeCalendarProviders;

  private providerHealth: CalendarProviderHealth[];

  constructor(
    providers: CompositeCalendarProviders,
  ) {
    this.providers = providers;
    this.providerHealth = [
      { providerId: "local", status: "ready" },
      ...(providers.google
        ? [{ providerId: "google" as const, status: "disconnected" as const }]
        : []),
    ];
  }

  getProviderHealth(): CalendarProviderHealth[] {
    return this.providerHealth;
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const localCalendars =
      await this.providers.local.getCalendars();

    if (!this.providers.google) {
      return localCalendars;
    }

    try {
      const googleCalendars =
        await this.providers.google.getCalendars();

      this.setGoogleHealth({
        providerId: "google",
        status: "ready",
      });

      return [...localCalendars, ...googleCalendars];
    } catch (error: unknown) {
      this.setGoogleReadError(error);
      return localCalendars;
    }
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const localEvents =
      await this.providers.local.getEvents(range);

    if (!this.providers.google) {
      return localEvents;
    }

    try {
      const googleEvents =
        await this.providers.google.getEvents(range);

      this.setGoogleHealth({
        providerId: "google",
        status: "ready",
      });

      return [...localEvents, ...googleEvents];
    } catch (error: unknown) {
      this.setGoogleReadError(error);
      return localEvents;
    }
  }

  createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CalendarEvent> {
    return this.providers.local.createEvent(input);
  }

  updateEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    return this.getProviderForSource(event.sourceId)
      .updateEvent(event);
  }

  deleteEvent(
    eventId: string,
    sourceId?: string,
  ): Promise<void> {
    return this.getProviderForSource(sourceId)
      .deleteEvent(eventId, sourceId);
  }

  restoreEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    return this.getProviderForSource(event.sourceId)
      .restoreEvent(event);
  }

  private getProviderForSource(
    sourceId?: string,
  ): CalendarProvider {
    if (
      sourceId?.startsWith("google:") &&
      this.providers.google
    ) {
      return this.providers.google;
    }

    return this.providers.local;
  }

  private setGoogleReadError(error: unknown): void {
    if (
      error instanceof CalendarProviderError &&
      error.code === "authentication"
    ) {
      this.setGoogleHealth({
        providerId: "google",
        status: "disconnected",
      });
      return;
    }

    const message = error instanceof CalendarProviderError
      ? error.message
      : "Google Kalender kunne ikke opdateres. Dine lokale kalendere vises stadig.";

    this.setGoogleHealth({
      providerId: "google",
      status: "error",
      message,
      canRetry: true,
    });
  }

  private setGoogleHealth(
    health: CalendarProviderHealth,
  ): void {
    this.providerHealth = this.providerHealth.map(
      (currentHealth) =>
        currentHealth.providerId === "google"
          ? health
          : currentHealth,
    );
  }
}
