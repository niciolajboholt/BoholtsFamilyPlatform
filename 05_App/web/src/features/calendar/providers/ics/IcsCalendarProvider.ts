import { familyPseudoMemberId } from "../../models/calendarEvent";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { CalendarEventRange, CalendarSource } from "../../models/calendarProvider";
import type { CalendarProvider } from "../CalendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import type { CalendarProviderErrorCode } from "../calendarProviderErrors";
import {
  getIcsSubscriptionEvents,
  getIcsSubscriptions,
  getMyFamily,
} from "../../../family/familyApi";
import type { IcsCalendarSubscriptionDto } from "../../../family/familyApi";
import {
  getFamilyMembers,
  getFamilyPseudoMemberServerId,
} from "../../preferences/familyMembersStorage";
import {
  ICS_OFFLINE_CACHE_MAX_AGE_MS,
  ICS_REFRESH_TTL_MS,
  getCachedIcsEvents,
  isIcsCacheEntryFresh,
  listCachedIcsSyncEntries,
  setCachedIcsEvents,
} from "../../preferences/icsCalendarSyncCacheStorage";
import { mapIcsCalendarEvent, mapIcsCalendarSource } from "./icsCalendarMapper";

/**
 * Delte kalendere tilføjet via et ICS-link (Fase 9) — altid skrivebeskyttet,
 * ingen login til kildens egen konto. Følger samme CalendarProvider-kontrakt
 * som Google/Outlook, men abonnementerne er familiedata (server-CRUD, se
 * familyApi.ts), ikke en OAuth-forbindelse — der er derfor intet
 * "authentication"-fejlspor her, kun "network" (kilden kunne ikke nås/
 * fortolkes).
 */
export class IcsCalendarProvider implements CalendarProvider {
  private familyId: string | null = null;

  // Sat af getEvents(), når (dele af) det senest returnerede resultat kom
  // fra den lokale cache i stedet for en frisk hentning — enten fordi cachen
  // stadig er inden for opdaterings-vinduet (den primære friskhedsstrategi,
  // se icsCalendarSyncCacheStorage.ts), eller fordi en kilde ikke kunne nås
  // og et offline-fallback blev brugt i stedet.
  private offlineCacheAsOf: string | null = null;

  getOfflineCacheAsOf(): string | null {
    return this.offlineCacheAsOf;
  }

  async getCalendars(): Promise<CalendarSource[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) return [];

    const listResult = await getIcsSubscriptions(familyId);
    if (!listResult.ok) return [];

    const subscriptions = listResult.data.subscriptions ?? [];
    const membersById = new Map(getFamilyMembers().map((member) => [member.id, member]));

    return subscriptions.map((subscription) => {
      const ownerId = this.toLocalOwnerId(subscription.familyMemberId);
      return mapIcsCalendarSource(subscription, ownerId ? membersById.get(ownerId) : undefined);
    });
  }

  async getEvents(range: CalendarEventRange): Promise<CalendarEvent[]> {
    const familyId = await this.resolveFamilyId();
    if (!familyId) {
      this.offlineCacheAsOf = null;
      return [];
    }

    const listResult = await getIcsSubscriptions(familyId);
    if (!listResult.ok) {
      // Selve abonnementslisten kunne ikke hentes — vi ved ikke engang,
      // hvilke abonnementer der findes lige nu, så fallbacket dækker ALT
      // hidtil kendt cachet indhold, ligesom Googles tilsvarende
      // hele-listen-fejlede-fallback.
      const fallback = this.getOfflineFallbackFromAllCaches();
      if (fallback) return fallback;

      this.offlineCacheAsOf = null;
      throw new CalendarProviderError(
        "network",
        "Kunne ikke hente familiens delte kalendere.",
      );
    }

    const subscriptions = listResult.data.subscriptions ?? [];
    const staleTimestamps: string[] = [];

    const eventsBySubscription = await Promise.all(
      subscriptions.map(async (subscription) => {
        const ownerId = this.toLocalOwnerId(subscription.familyMemberId);

        try {
          return await this.fetchSubscriptionEvents(subscription, range, ownerId);
        } catch {
          // Isolerer fejl pr. abonnement — én ubesvarende kilde må ikke
          // skjule familiens øvrige, fungerende delte kalendere. Hver kildes
          // seneste hentningsstatus vises allerede for sig i
          // IcsSubscriptionsPanel (Indstillinger → Kalenderforbindelser), så
          // ingen fejl går tabt ved at gøre dette tavst her.
          const fallback = this.getOfflineFallbackForSubscription(subscription.id);
          if (fallback) {
            staleTimestamps.push(fallback.updatedAt);
            return fallback.events;
          }
          return [];
        }
      }),
    );

    this.offlineCacheAsOf =
      staleTimestamps.length > 0
        ? staleTimestamps.reduce((oldest, current) => (current < oldest ? current : oldest))
        : null;

    return eventsBySubscription.flat();
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    void input;
    throw new CalendarProviderError("authorization", "Delte ICS-kalendere er skrivebeskyttede.");
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    void event;
    throw new CalendarProviderError("authorization", "Delte ICS-kalendere er skrivebeskyttede.");
  }

  async deleteEvent(eventId: string, sourceId?: string): Promise<void> {
    void eventId;
    void sourceId;
    throw new CalendarProviderError("authorization", "Delte ICS-kalendere er skrivebeskyttede.");
  }

  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> {
    void event;
    throw new CalendarProviderError("authorization", "Delte ICS-kalendere er skrivebeskyttede.");
  }

  private async resolveFamilyId(): Promise<string | null> {
    if (this.familyId) return this.familyId;
    const result = await getMyFamily();
    this.familyId = result.ok && result.data.family ? result.data.family.id : null;
    return this.familyId;
  }

  // Mirror af calendarMemberMappingStorage.ts's private toLocalOwnerId (ikke
  // eksporteret derfra) — samme regel: kun familie-pseudomedlemmets
  // server-id skal oversættes til det lokale "family", ethvert andet
  // familymember-id er allerede det lokale ejer-id.
  private toLocalOwnerId(serverMemberId: string | null): CalendarOwnerId | undefined {
    if (!serverMemberId) return undefined;
    if (serverMemberId === getFamilyPseudoMemberServerId()) return familyPseudoMemberId;
    return serverMemberId as CalendarOwnerId;
  }

  private async fetchSubscriptionEvents(
    subscription: IcsCalendarSubscriptionDto,
    range: CalendarEventRange,
    ownerId: CalendarOwnerId | undefined,
  ): Promise<CalendarEvent[]> {
    const cached = getCachedIcsEvents(subscription.id);
    if (cached && isIcsCacheEntryFresh(cached.updatedAt, ICS_REFRESH_TTL_MS)) {
      return cached.events;
    }

    const result = await getIcsSubscriptionEvents(subscription.familyId, subscription.id, range);
    if (!result.ok) {
      throw new CalendarProviderError(
        toIcsErrorCode(result.status),
        result.data.error ?? "Kunne ikke hente den delte kalender.",
      );
    }

    const mapped = (result.data.events ?? []).map((event) =>
      mapIcsCalendarEvent(subscription.id, event, ownerId),
    );
    setCachedIcsEvents(subscription.id, mapped);
    return mapped;
  }

  private getOfflineFallbackForSubscription(
    subscriptionId: string,
  ): { events: CalendarEvent[]; updatedAt: string } | null {
    const cached = getCachedIcsEvents(subscriptionId);
    if (!cached || !isIcsCacheEntryFresh(cached.updatedAt, ICS_OFFLINE_CACHE_MAX_AGE_MS)) {
      return null;
    }
    return cached;
  }

  private getOfflineFallbackFromAllCaches(): CalendarEvent[] | null {
    const freshEntries = listCachedIcsSyncEntries().filter((entry) =>
      isIcsCacheEntryFresh(entry.state.updatedAt, ICS_OFFLINE_CACHE_MAX_AGE_MS),
    );
    if (freshEntries.length === 0) return null;

    this.offlineCacheAsOf = freshEntries
      .map((entry) => entry.state.updatedAt)
      .reduce((oldest, current) => (current < oldest ? current : oldest));

    return freshEntries.flatMap((entry) => entry.state.events);
  }
}

function toIcsErrorCode(status: number): CalendarProviderErrorCode {
  if (status === 400) return "validation";
  if (status === 404) return "not-found";
  if (status === 502 || status === 504) return "network";
  return "unknown";
}
