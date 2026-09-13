import type { CalendarOwner } from "../../data/calendarOwners";
import type { CalendarEvent, CalendarOwnerId } from "../../models/calendarEvent";
import type { CalendarSource } from "../../models/calendarProvider";
import type { IcloudCalendarEventDto, IcloudCalendarInfoDto } from "../../../family/familyApi";
import { encodeIcloudCalendarSourceId, encodeIcloudEventId } from "./icloudCalendarIds";

const fallbackColor = "#8E8E93";

// Sprint 48: ejerskab kommer nu fra calendar_member_mappings (nøglet på
// kalenderens rå CalDAV-URL), samme mekanisme som Google/Outlook — IKKE
// længere forbindelsens egen family_member_id, som Sprint 47 brugte. Se
// IcloudCalendarProvider.ts.
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
