import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type {
  IcsCalendarEventDto,
  IcsCalendarSubscriptionDto,
} from "../../../family/familyApi";
import { encodeIcsCalendarSourceId, encodeIcsEventId } from "./icsCalendarIds";

const fallbackColor = "#5C6BC0";

/**
 * `mappedOwner`, hvis abonnementet er tildelt et familiemedlem — kilden viser
 * da medlemmets navn/farve i stedet for abonnementets eget navn, samme
 * princip som Google/Outlook (ADR-014). Selve tildelingen slås op af
 * kalderen (IcsCalendarProvider), ikke her.
 *
 * Farve-fortrin: tildelt medlems farve > familiens eget valgte farve på
 * abonnementet > generisk standardfarve. Et tildelt medlem vinder altid,
 * så kalenderen ser ud og opfører sig som en af appens egne
 * familiekalendre — den valgte farve er kun til at adskille flere
 * IKKE-tildelte abonnementer fra hinanden.
 */
export function mapIcsCalendarSource(
  subscription: IcsCalendarSubscriptionDto,
  mappedOwner?: CalendarOwner,
): CalendarSource {
  return {
    id: encodeIcsCalendarSourceId(subscription.id),
    name: mappedOwner?.name ?? subscription.label,
    providerType: "ics",
    color: mappedOwner?.color ?? subscription.color ?? fallbackColor,
    isVisible: true,
    isReadOnly: true,
    externalReference: subscription.id,
  };
}

export function mapIcsCalendarEvent(
  subscriptionId: string,
  event: IcsCalendarEventDto,
  ownerId: CalendarOwnerId | undefined,
): CalendarEvent {
  return {
    id: encodeIcsEventId(subscriptionId, event.id),
    source: "ics",
    sourceId: encodeIcsCalendarSourceId(subscriptionId),
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    ownerIds: ownerId ? [ownerId] : [],
    description: event.description,
    location: event.location,
    privacy: event.isPrivate ? "busy" : undefined,
  };
}
