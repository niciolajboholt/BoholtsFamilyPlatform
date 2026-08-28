import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { CalendarEvent } from "../models/calendarEvent";

export const neutralFallbackColor = "#607d8b";

type ColorableEvent = Pick<CalendarEvent, "ownerIds" | "color">;
type SourceColorEvent = ColorableEvent & Pick<CalendarEvent, "sourceId">;

/**
 * De farve(r), en aftale skal vises med i kalenderen — ÉN central regel,
 * brugt identisk af måned-, uge-, dag-, familie- og listevisningen.
 *
 * Fortrin:
 * 1. En reel familieaftale bruger Familien-farven.
 * 2. Navngivne medlemmer bruger altid deres aktuelle farver fra Indstillinger.
 * 3. En kilde uden medlem bruger aftalens egen kildefarve (fx ICS).
 * 4. Ellers bruges en neutral standardfarve.
 */
export function getEventOwnerColors(
  event: ColorableEvent,
  members: readonly CalendarOwner[],
): string[] {
  if (event.ownerIds.includes(familyPseudoMemberId)) {
    const familyColor =
      members.find((member) => member.id === familyPseudoMemberId)?.color ?? neutralFallbackColor;
    return [familyColor];
  }

  if (event.ownerIds.length > 0) {
    const memberColors = event.ownerIds
      .map((ownerId) => members.find((member) => member.id === ownerId)?.color)
      .filter((color): color is string => Boolean(color));

    if (memberColors.length > 0) {
      return Array.from(new Set(memberColors));
    }
  }

  return [event.color ?? neutralFallbackColor];
}

export function getEventOwnerColor(
  event: ColorableEvent,
  members: readonly CalendarOwner[],
): string {
  return getEventOwnerColors(event, members)[0];
}

/**
 * Farverne ved en kalenderkilde skal afspejle de aftaler, filteret styrer.
 * Derfor udledes de af samme centrale medlemsregel som aftalekortene.
 * Kildens egen farve bruges kun, når der endnu ikke findes aftaler i det
 * indlæste vindue eller ingen medlemstilknytning kan udledes.
 */
export function getCalendarSourceDisplayColors(
  sourceId: string,
  sourceColor: string,
  events: readonly SourceColorEvent[],
  members: readonly CalendarOwner[],
): string[] {
  const resolvedColors = events
    .filter((event) => event.sourceId === sourceId)
    .flatMap((event) => getEventOwnerColors(event, members));

  const uniqueColors = Array.from(new Set(resolvedColors));
  return uniqueColors.length > 0 ? uniqueColors : [sourceColor];
}

/**
 * Tegner en fuldt mættet accent inde i aftalekortet. En pseudo-element-stribe
 * undgår den halvmåneform, som en almindelig border får på afrundede kort.
 * Ved flere medlemmer deles striben i skarpe, lige store farvefelter.
 */
export function getEventOwnerBorderSx(
  colors: readonly string[],
  widthPx: number,
) {
  const resolvedColors = colors.length > 0 ? colors : [neutralFallbackColor];
  const background =
    resolvedColors.length === 1
      ? resolvedColors[0]
      : `linear-gradient(to bottom, ${resolvedColors
          .flatMap((color, index) => {
            const start = (index / resolvedColors.length) * 100;
            const end = ((index + 1) / resolvedColors.length) * 100;
            return [`${color} ${start}%`, `${color} ${end}%`];
          })
          .join(", ")})`;

  return {
    position: "relative" as const,
    borderLeft: "none",
    "&::before": {
      content: '""',
      position: "absolute" as const,
      top: 0,
      bottom: 0,
      left: 0,
      width: `${widthPx}px`,
      background,
      pointerEvents: "none" as const,
    },
  };
}
