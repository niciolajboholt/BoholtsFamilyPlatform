import type { CalendarEvent } from "../models/calendarEvent";

/**
 * Returnerer én post pr. stabil provider-identitet.
 *
 * Titel og tidspunkt indgår bevidst ikke i nøglen: to forskellige aftaler må
 * gerne have samme titel og tidsrum. Eksterne event-id'er er allerede kodet
 * med kalender-id, men sourceId beholdes eksplicit i nøglen som værn mod
 * fremtidige providers med mindre stærke id-kontrakter. Forekomststart gør
 * gentagne forekomster entydige, selv hvis en provider genbruger master-id'et.
 *
 * Hvis samme identitet modtages flere gange, vinder den seneste værdi. Det
 * håndterer overlap mellem sider/cache-deltaer uden at vise en ældre kopi.
 */
export function deduplicateCalendarEvents(
  events: readonly CalendarEvent[],
): CalendarEvent[] {
  const eventsByIdentity = new Map<string, CalendarEvent>();

  for (const event of events) {
    const identity = [
      event.source,
      event.sourceId,
      event.id,
      event.recurrenceOccurrenceStart ?? "",
    ].join("\u0000");

    eventsByIdentity.set(identity, event);
  }

  return [...eventsByIdentity.values()];
}
