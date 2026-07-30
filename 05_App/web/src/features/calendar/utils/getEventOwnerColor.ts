import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { CalendarEvent } from "../models/calendarEvent";

const fallbackColor = "#607d8b";

/**
 * A single, named owner gets their own color. A shared/"family" event, or
 * one with multiple owners, uses the family color — there's no single
 * person's color that would be correct to show.
 */
export function getEventOwnerColor(
  event: Pick<CalendarEvent, "ownerIds">,
  members: readonly CalendarOwner[],
): string {
  const familyColor =
    members.find((member) => member.id === familyPseudoMemberId)?.color ??
    fallbackColor;

  if (event.ownerIds.length !== 1) {
    return familyColor;
  }

  const [ownerId] = event.ownerIds;

  if (ownerId === familyPseudoMemberId) {
    return familyColor;
  }

  return (
    members.find((member) => member.id === ownerId)?.color ?? fallbackColor
  );
}
