import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarEvent } from "../models/calendarEvent";
import { getEventOwnerBadges } from "./getEventOwnerColor";

export function formatCalendarDate(
  date: Date,
): string {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
  }).format(date);
}

export function getDayActionLabel(
  date: Date,
): string {
  return `Vælg dag og opret aftale den ${formatCalendarDate(date)}`;
}

// members er valgfri, så eksisterende kaldesteder ikke tvinges til at
// opdateres samtidig — uden den udelades blot ejernavnet fra labelen
// (samme adfærd som før).
export function getEventActionLabel(
  event: CalendarEvent,
  members?: readonly CalendarOwner[],
): string {
  const ownerNames = members
    ? getEventOwnerBadges(event, members).map((owner) => owner.name)
    : [];
  const ownerSuffix = ownerNames.length > 0 ? `, ${ownerNames.join(" og ")}` : "";

  if (event.allDay) {
    return `Rediger aftale: ${event.title}, hele dagen${ownerSuffix}`;
  }

  const time = new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.start));

  return `Rediger aftale: ${event.title}, ${time}${ownerSuffix}`;
}
