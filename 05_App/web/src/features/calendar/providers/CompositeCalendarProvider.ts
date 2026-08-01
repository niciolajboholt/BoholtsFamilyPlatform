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

export interface ExternalCalendarProvider {
  providerId: Exclude<CalendarProviderType, "local">;
  provider: CalendarProvider;
  // e.g. "google:" / "outlook:" — used to route a sourceId to its provider
  // without the composite needing to know each provider's internals.
  sourceIdPrefix: string;
}

interface CompositeCalendarProviders {
  local: CalendarProvider;
  external: ExternalCalendarProvider[];
}

/**
 * Samler uafhængige kalenderkilder, uden at React-laget behøver kende deres
 * konkrete implementeringer. En fejl i én valgfri ekstern kilde må ikke skjule
 * familiens lokale aftaler eller andre eksterne kilders aftaler.
 */
export class CompositeCalendarProvider
  implements CalendarProvider
{
  private readonly local: CalendarProvider;

  private readonly external: ExternalCalendarProvider[];

  private providerHealth: CalendarProviderHealth[];

  constructor(
    providers: CompositeCalendarProviders,
  ) {
    this.local = providers.local;
    this.external = providers.external;
    this.providerHealth = [
      { providerId: "local", status: "ready" },
      ...this.external.map((entry) => ({
        providerId: entry.providerId,
        status: "disconnected" as const,
      })),
    ];
  }

  getProviderHealth(): CalendarProviderHealth[] {
    return this.providerHealth;
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const localCalendars = await this.local.getCalendars();

    if (this.external.length === 0) {
      return localCalendars;
    }

    let didAnyExternalSucceed = false;

    const externalResults = await Promise.all(
      this.external.map(async (entry) => {
        try {
          const calendars = await entry.provider.getCalendars();
          didAnyExternalSucceed = true;
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

    // Demo-kalenderen ("google:demo") er kun en pladsholder for brugere, der
    // endnu ikke har forbundet en rigtig ekstern konto. Så snart mindst én
    // ekstern kilde faktisk svarer, er den overflødig og skal væk.
    return [
      ...localCalendars.filter(
        (source) => !didAnyExternalSucceed || source.id !== "google:demo",
      ),
      ...externalResults.flat(),
    ];
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    const localEvents = await this.local.getEvents(range);

    if (this.external.length === 0) {
      return localEvents;
    }

    const externalResults = await Promise.all(
      this.external.map(async (entry) => {
        try {
          const events = await entry.provider.getEvents(range);
          this.setProviderHealth(entry.providerId, {
            providerId: entry.providerId,
            status: "ready",
          });
          return events;
        } catch (error: unknown) {
          this.setProviderReadError(entry.providerId, error);
          return [];
        }
      }),
    );

    return [...localEvents, ...externalResults.flat()];
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
    if (!sourceId) return this.local;
    if (sourceId.startsWith("local:")) return this.local;

    const match = this.external.find((entry) =>
      sourceId.startsWith(entry.sourceIdPrefix),
    );
    if (match) return match.provider;

    throw new CalendarProviderError("not-found", "Kalenderkilden findes ikke længere.");
  }

  private setProviderReadError(
    providerId: Exclude<CalendarProviderType, "local">,
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
      : "Kalenderen kunne ikke opdateres. Dine lokale kalendere vises stadig.";

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
