import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { CalendarEvent } from "../models/calendarEvent";

export const neutralFallbackColor = "#607d8b";

type ColorableEvent = Pick<CalendarEvent, "ownerIds" | "color">;

/**
 * De farve(r), en aftale skal vises med i kalenderen — ÉN central regel,
 * brugt identisk af måned- (DayCell), uge- (WeekCalendar), dag-
 * (DayCalendar), familie- (FamilyPlannerCalendar) og listevisningen
 * (EventList), i stedet for hver sin specialregel. Rækkefølgen matcher
 * ownerIds, så en flerfarvet venstrekant (getEventOwnerBorderSx) viser
 * medlemmerne i samme rækkefølge som deres navnemærkater.
 *
 * Fortrin:
 * 1. Aftalen er eksplicit tildelt familie-pseudomedlemmet ("family") — en
 *    REEL fælles/familie-aftale — Familien-farven, uanset øvrige ownerIds.
 * 2. Ét eller flere reelle, navngivne medlemmer (fx deltager-match på en
 *    Google-aftale, eller en enkelt kalender-/ICS-tildeling) — hvert
 *    medlems egen, aktuelle farve fra Indstillinger. Flere medlemmer giver
 *    IKKE Familien-farven — det var netop den fejl, denne funktion retter.
 * 3. Intet medlem-ejerskab, men aftalen har sin egen kildefarve (fx et
 *    IKKE-tildelt ICS-abonnements selvvalgte farve, se
 *    icsCalendarMapper.ts) — den farve.
 * 4. Intet af ovenstående (fx en helt ukendt/uden mapping Google-kalender)
 *    — neutral standardfarve.
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
      return memberColors;
    }
  }

  return [event.color ?? neutralFallbackColor];
}

/**
 * Bekvem enkeltfarve til steder, der kun viser/bruger én farve ad gangen
 * (baggrundstoning, teksts farve, en enkelt kant uden opdeling) — den
 * første/primære farve fra getEventOwnerColors(). Brug
 * getEventOwnerColors() direkte, hvor en flerfarvet aftale skal vises
 * tydeligt (fx en opdelt venstrekant, se getEventOwnerBorderSx()).
 */
export function getEventOwnerColor(
  event: ColorableEvent,
  members: readonly CalendarOwner[],
): string {
  return getEventOwnerColors(event, members)[0];
}

/**
 * Fælles, simpel visning af en aftales farve(r) som en venstrekant — solid
 * ved én farve, ellers opdelt i lige store, skarpt afgrænsede felter (ikke
 * en blødt overtonet gradient) ved flere. Bruges identisk af alle
 * kalendervisninger i stedet for hver sin borderLeft-logik.
 */
export function getEventOwnerBorderSx(
  colors: readonly string[],
  widthPx: number,
): { borderLeft: string; borderImage?: string } {
  if (colors.length <= 1) {
    return { borderLeft: `${widthPx}px solid ${colors[0] ?? neutralFallbackColor}` };
  }

  const stops = colors.flatMap((color, index) => {
    const start = (index / colors.length) * 100;
    const end = ((index + 1) / colors.length) * 100;
    return [`${color} ${start}%`, `${color} ${end}%`];
  });

  return {
    borderLeft: `${widthPx}px solid`,
    borderImage: `linear-gradient(to bottom, ${stops.join(", ")}) 1`,
  };
}
