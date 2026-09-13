import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type { IcloudCalendarEventDto, IcloudCalendarInfoDto } from "../../../family/familyApi";
import { encodeIcloudCalendarSourceId, encodeIcloudEventId } from "./icloudCalendarIds";

const fallbackColor = "#8E8E93";

// Ejerskab kommer direkte fra forbindelsens family_member_id (samme princip
// som ICS' subscription.familyMemberId), IKKE calendar_member_mappings —
// hver iCloud-forbindelse ejes allerede af ét bestemt familiemedlem (Sprint
// 47's beslutning: flere medlemmer forbinder hver deres egen konto).
export function mapIcloudCalendarSource(
  connectionId: string,
  calendar: IcloudCalendarInfoDto,
  mappedOwner?: CalendarOwner,
): CalendarSource {
  return {
    id: encodeIcloudCalendarSourceId(connectionId, calendar.url),
    name: mappedOwner?.name ?? calendar.displayName,
    providerType: "apple",
    color: mappedOwner?.color ?? fallbackColor,
    isVisible: true,
    isReadOnly: false,
    externalReference: calendar.url,
  };
}

export function mapIcloudCalendarEvent(
  connectionId: string,
  calendarUrl: string,
  event: IcloudCalendarEventDto,
  ownerId: CalendarOwnerId | undefined,
): CalendarEvent {
  return {
    id: encodeIcloudEventId(connectionId, calendarUrl, event.uid, event.href, event.etag),
    source: "apple",
    sourceId: encodeIcloudCalendarSourceId(connectionId, calendarUrl),
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    ownerIds: ownerId ? [ownerId] : [],
    description: event.description,
    location: event.location,
  };
}
