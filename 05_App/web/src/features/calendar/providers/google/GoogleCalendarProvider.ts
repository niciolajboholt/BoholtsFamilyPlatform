import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import type { CalendarEventRange, CalendarSource } from "../../models/calendarProvider";
import type { CalendarProvider } from "../CalendarProvider";
import { CalendarProviderError } from "../calendarProviderErrors";
import { GoogleCalendarApi } from "./GoogleCalendarApi";
import type { GoogleCalendarEvent } from "./googleCalendarTypes";
import {
  mapGoogleCalendarEvent,
  mapGoogleCalendarSource,
} from "./googleCalendarMapper";
import {
  decodeGoogleEventId,
  decodeGoogleCalendarSourceId,
  encodeGoogleCalendarSourceId,
  encodeGoogleEventId,
} from "./googleCalendarIds";
import { mapGoogleEventWriteRequest } from "./googleCalendarWriteMapper";
import { getExcludedGoogleCalendarIds } from "../../preferences/googleCalendarExclusionStorage";
import {
  clearCachedCalendarSyncState,
  getCachedCalendarSyncState,
  isCacheEntryFresh,
  listCachedCalendarSyncEntries,
  setCachedCalendarSyncState,
} from "../../preferences/googleCalendarSyncCacheStorage";
import {
  getCalendarMemberMappings,
  getMappedOwnersByCalendarId,
  refreshCalendarMemberMappingsFromServer,
} from "../../preferences/calendarMemberMappingStorage";
import { getFamilyMembers } from "../../preferences/familyMembersStorage";

export class GoogleCalendarProvider implements CalendarProvider {
  private readonly api = new GoogleCalendarApi();
  private calendarSources: CalendarSource[] = [];

  // Fase 8: sat af getEvents(), når det senest returnerede resultat kom fra
  // den lokale offline-fallback i stedet for en frisk serverhentning — null
  // ellers. Bruges af CompositeCalendarProvider til at vise en "sidst
  // opdateret"-besked, jf. 31_Offline_Data_Policy.md.
  private offlineCacheAsOf: string | null = null;

  getOfflineCacheAsOf(): string | null {
    return this.offlineCacheAsOf;
  }

  async getCalendars(): Promise<CalendarSource[]> {
    await refreshCalendarMemberMappingsFromServer();
    const calendars = await this.api.listCalendars();
    const excludedIds = new Set(getExcludedGoogleCalendarIds());
    const mappedOwnersByCalendarId = getMappedOwnersByCalendarId(getFamilyMembers());

    const sources = calendars
      .filter((calendar) => !calendar.id || !excludedIds.has(calendar.id))
      .map((calendar) =>
        mapGoogleCalendarSource(
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
   * "Vælg Google-kalendere"-dialogen, som skal kunne vise og fravælge/
   * genvælge ALLE kalendere, også dem der allerede er ekskluderet fra en
   * tidligere runde. getCalendars() må fortsat filtrere, da den bruges til
   * den faktiske kalendervisning i resten af appen.
   */
  async listAllCalendars(): Promise<CalendarSource[]> {
    const calendars = await this.api.listCalendars();

    return calendars
      .map((calendar) => mapGoogleCalendarSource(calendar))
      .filter((source): source is CalendarSource => source !== null);
  }

  async getEvents(
    range: CalendarEventRange,
  ): Promise<CalendarEvent[]> {
    try {
      await refreshCalendarMemberMappingsFromServer();
      const calendars = await this.api.listCalendars();
      const excludedIds = new Set(getExcludedGoogleCalendarIds());
      const mappings = getCalendarMemberMappings();
      const eventsByCalendar = await Promise.all(
        calendars
          .filter((calendar) => Boolean(calendar.id) && !excludedIds.has(calendar.id!))
          .map((calendar) =>
            this.fetchCalendarEvents(calendar.id!, range, mappings[calendar.id!]),
          ),
      );

      this.offlineCacheAsOf = null;
      return eventsByCalendar.flat();
    } catch (error) {
      const fallback = this.getOfflineFallbackEvents(error);
      if (!fallback) {
        throw error;
      }

      return fallback;
    }
  }

  // Fase 8: kun en netværksfejl (reelt offline, eller Google Kalender
  // uopnåelig) udløser fallbacket — enhver anden fejl (fx auth) skal stadig
  // vises som en fejl, ikke tavst skjules bag potentielt forældet data.
  // Jf. 31_Offline_Data_Policy.md: kun cache-poster inden for TTL'en
  // (7 dage) bruges; er intet friskt nok, er der ingen fallback, og den
  // oprindelige fejl kastes videre som hidtil.
  private getOfflineFallbackEvents(error: unknown): CalendarEvent[] | null {
    if (!(error instanceof CalendarProviderError) || error.code !== "network") {
      return null;
    }

    const excludedIds = new Set(getExcludedGoogleCalendarIds());
    const freshEntries = listCachedCalendarSyncEntries().filter(
      (entry) =>
        !excludedIds.has(entry.calendarId) && isCacheEntryFresh(entry.state.updatedAt),
    );

    if (freshEntries.length === 0) {
      return null;
    }

    this.offlineCacheAsOf = freshEntries
      .map((entry) => entry.state.updatedAt)
      .reduce((oldest, current) => (current < oldest ? current : oldest));

    return freshEntries.flatMap((entry) => entry.state.events);
  }

  // Sprint 25: bruger et cachet syncToken, hvis et findes, til kun at hente
  // ÆNDRINGER siden sidst (F-05) — falder tilbage til en fuld
  // tidsvindue-synk (dagens hidtidige adfærd) hvis intet er cachet endnu,
  // eller hvis Google afviser tokenet som udløbet (410 Gone, mappes til
  // CalendarProviderError med code "not-found").
  private async fetchCalendarEvents(
    calendarId: string,
    range: CalendarEventRange,
    mappedOwnerId: CalendarOwnerId | undefined,
  ): Promise<CalendarEvent[]> {
    const cached = getCachedCalendarSyncState(calendarId);

    if (cached) {
      try {
        const page = await this.api.listEvents(calendarId, { syncToken: cached.syncToken });
        const merged = mergeGoogleEventDelta(cached.events, page.events, calendarId, mappedOwnerId);

        if (page.nextSyncToken) {
          setCachedCalendarSyncState(calendarId, { events: merged, syncToken: page.nextSyncToken });
        } else {
          clearCachedCalendarSyncState(calendarId);
        }

        return merged;
      } catch (error) {
        if (!(error instanceof CalendarProviderError) || error.code !== "not-found") {
          throw error;
        }

        clearCachedCalendarSyncState(calendarId);
      }
    }

    const page = await this.api.listEvents(calendarId, { range });
    const mapped = page.events
      .map((event) => mapGoogleCalendarEvent(calendarId, event, mappedOwnerId))
      .filter((event): event is CalendarEvent => event !== null);

    if (page.nextSyncToken) {
      setCachedCalendarSyncState(calendarId, { events: mapped, syncToken: page.nextSyncToken });
    }

    return mapped;
  }

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    const sourceId = input.sourceId;
    if (!sourceId) throw new CalendarProviderError("validation", "Vælg en Google-kalender.");
    const calendarId = decodeGoogleCalendarSourceId(sourceId);
    await this.assertWritableSource(sourceId);
    const created = await this.api.createEvent(calendarId, mapGoogleEventWriteRequest(input));
    return await this.mapWrittenEvent(calendarId, created);
  }

  async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
    if (event.source !== "google") throw new CalendarProviderError("validation", "Aftalen er ikke en Google-aftale.");
    await this.assertWritableSource(event.sourceId);

    const { calendarId: originCalendarId, eventId } = decodeGoogleEventId(event.id);
    const targetCalendarId = decodeGoogleCalendarSourceId(event.sourceId);

    if (originCalendarId === targetCalendarId) {
      const updated = await this.api.updateEvent(originCalendarId, eventId, mapGoogleEventWriteRequest(event));
      return await this.mapWrittenEvent(originCalendarId, updated);
    }

    // event.sourceId peger på en anden kalender end den, aftalen faktisk
    // ligger i lige nu — brugeren har skiftet kalender i redigér-dialogen.
    // Google kræver en dedikeret "move" for selve kalenderskiftet (skriveadgang
    // til BÅDE afsender- og modtager-kalenderen), og tillader ikke andre
    // feltændringer i samme kald — øvrige ændringer (titel, tid, osv.)
    // patches derfor separat, mod den flyttede aftale.
    await this.assertWritableSource(encodeGoogleCalendarSourceId(originCalendarId));
    const moved = await this.api.moveEvent(originCalendarId, eventId, targetCalendarId);
    const updated = await this.api.updateEvent(targetCalendarId, moved.id ?? eventId, mapGoogleEventWriteRequest(event));
    return await this.mapWrittenEvent(targetCalendarId, updated);
  }

  async deleteEvent(eventId: string, sourceId?: string): Promise<void> {
    if (!sourceId) throw new CalendarProviderError("validation", "Google-kalender mangler.");
    await this.assertWritableSource(sourceId);
    const { calendarId, eventId: googleEventId } = decodeGoogleEventId(eventId);
    if (calendarId !== decodeGoogleCalendarSourceId(sourceId)) throw new CalendarProviderError("validation", "Google-aftalen tilhører en anden kalender.");
    await this.api.deleteEvent(calendarId, googleEventId);
  }
  async restoreEvent(event: CalendarEvent): Promise<CalendarEvent> { void event; throw new CalendarProviderError("authorization", "Google Kalender er skrivebeskyttet."); }

  private async assertWritableSource(sourceId: string): Promise<void> {
    const sources = this.calendarSources.length > 0
      ? this.calendarSources
      : await this.getCalendars();
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new CalendarProviderError("not-found", "Google-kalenderen findes ikke længere.");
    if (source.isReadOnly) throw new CalendarProviderError("authorization", "Denne Google-kalender er skrivebeskyttet.");
  }

  private async mapWrittenEvent(calendarId: string, event: import("./googleCalendarTypes").GoogleCalendarEvent): Promise<CalendarEvent> {
    // getCalendars()/getEvents() har typisk allerede varmet cachen op forud
    // for et skriv-kald (assertWritableSource kalder getCalendars(), hvis
    // den ikke allerede er kaldt) — intet ekstra serverkald nødvendigt her.
    const mappedOwnerId: CalendarOwnerId | undefined = getCalendarMemberMappings()[calendarId];
    const mapped = mapGoogleCalendarEvent(calendarId, event, mappedOwnerId);
    if (!mapped) throw new CalendarProviderError("unknown", "Google Kalender sendte en ugyldig aftale.");
    return mapped;
  }
}

// Sprint 25: en inkrementel synk returnerer kun ÆNDREDE/SLETTEDE events, ikke
// hele listen — denne funktion anvender de ændringer på den cachede liste
// fra sidste synk. En aflyst/slettet event mapper til null (se
// mapGoogleCalendarEvent) og fjernes derfor fra resultatet i stedet for at
// blive indsat som en ugyldig aftale.
function mergeGoogleEventDelta(
  cachedEvents: CalendarEvent[],
  deltaEvents: GoogleCalendarEvent[],
  calendarId: string,
  mappedOwnerId: CalendarOwnerId | undefined,
): CalendarEvent[] {
  const eventsById = new Map(cachedEvents.map((event) => [event.id, event]));

  for (const rawEvent of deltaEvents) {
    if (!rawEvent.id) continue;

    const id = encodeGoogleEventId(calendarId, rawEvent.id);
    const mapped = mapGoogleCalendarEvent(calendarId, rawEvent, mappedOwnerId);

    if (mapped) {
      eventsById.set(id, mapped);
    } else {
      eventsById.delete(id);
    }
  }

  return [...eventsById.values()];
}
