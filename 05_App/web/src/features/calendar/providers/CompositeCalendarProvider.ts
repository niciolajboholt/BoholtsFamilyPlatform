import type { CalendarEvent } from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import type {
  CalendarEventRange,
  CalendarProviderType,
  CalendarSource,
} from "../models/calendarProvider";
import type { CalendarProviderHealth } from "../models/calendarProviderHealth";
import type { CalendarProvider } from "./CalendarProvider";
import { CalendarProviderError } from "./calendarProviderErrors";
import { deduplicateCalendarEvents } from "../utils/deduplicateCalendarEvents";

export interface ExternalCalendarProvider {
  providerId: CalendarProviderType;
  provider: CalendarProvider;
  // e.g. "google:" / "outlook:" — used to route a sourceId to its provider
  // without the composite needing to know each provider's internals.
  sourceIdPrefix: string;
}

interface CompositeCalendarProviders {
  external: ExternalCalendarProvider[];
}

/**
 * Samler uafhængige kalenderkilder, uden at React-laget behøver kende deres
 * konkrete implementeringer. En fejl i én ekstern kilde må ikke skjule andre
 * eksterne kilders aftaler.
 *
 * Fase 5 (ADR-017): intet lokalt lag længere — alle aftaler ejes af en
 * ekstern konto (Google/Outlook/Apple).
 */
export class CompositeCalendarProvider
  implements CalendarProvider
{
  private readonly external: ExternalCalendarProvider[];

  private providerHealth: CalendarProviderHealth[];

  constructor(
    providers: CompositeCalendarProviders,
  ) {
    this.external = providers.external;
    this.providerHealth = this.external.map((entry) => ({
      providerId: entry.providerId,
      status: "disconnected" as const,
    }));
  }

  getProviderHealth(): CalendarProviderHealth[] {
    return this.providerHealth;
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const externalResults = await Promise.all(
      this.external.map(async (entry) => {
        try {
          const calendars = await entry.provider.getCalendars();
          this.setProviderHealth(entry.providerId, {
            providerId: entry.providerId,
            status: "ready",
          });
          return calendars;
        } catch (error: unknown) {
          this.setProviderReadError(entry.providerId, error);
          return [];
        }
      }),
    );

    return externalResults.flat();
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const externalResults = await Promise.all(
      this.external.map(async (entry) => {
        try {
          const events = await entry.provider.getEvents(range);
          const staleDataAsOf = entry.provider.getOfflineCacheAsOf?.() ?? undefined;
          this.setProviderHealth(entry.providerId, {
            providerId: entry.providerId,
            status: "ready",
            staleDataAsOf,
          });
          return events;
        } catch (error: unknown) {
          this.setProviderReadError(entry.providerId, error);
          return [];
        }
      }),
    );

    return deduplicateCalendarEvents(externalResults.flat());
  }

  createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CalendarEvent> {
    return this.getProviderForSource(input.sourceId)
      .createEvent(input);
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
    const match = sourceId
      ? this.external.find((entry) => sourceId.startsWith(entry.sourceIdPrefix))
      : undefined;
    if (match) return match.provider;

    throw new CalendarProviderError("not-found", "Kalenderkilden findes ikke længere.");
  }

  private setProviderReadError(
    providerId: CalendarProviderType,
    error: unknown,
  ): void {
    if (
      error instanceof CalendarProviderError &&
      error.code === "authentication"
    ) {
      this.setProviderHealth(providerId, {
        providerId,
        status: "disconnected",
      });
      return;
    }

    const message = error instanceof CalendarProviderError
      ? error.message
      : "Kalenderen kunne ikke opdateres. Andre forbundne kalendere vises stadig.";

    this.setProviderHealth(providerId, {
      providerId,
      status: "error",
      message,
      canRetry: true,
    });
  }

  private setProviderHealth(
    providerId: CalendarProviderType,
    health: CalendarProviderHealth,
  ): void {
    this.providerHealth = this.providerHealth.map(
      (currentHealth) =>
        currentHealth.providerId === providerId
          ? health
          : currentHealth,
    );
  }
}
