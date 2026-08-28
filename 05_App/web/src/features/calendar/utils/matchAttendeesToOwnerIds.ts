import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarOwnerId } from "../models/calendarEvent";

export interface EventAttendee {
  email?: string;
}

/**
 * Matcher en aftales deltagerliste (Google-aftalers "attendees") mod
 * familiemedlemmernes koblede kontoemail — mere præcist end kalender-
 * niveau-tildelingen (calendarMemberMappingStorage.ts), som kun ved hvilken
 * KALENDER aftalen ligger på, ikke hvem den faktisk er for. En aftale på en
 * delt/familie-kalender, der reelt inviterer to specifikke medlemmer, kan
 * dermed vises med deres egne farver/mærkater i stedet for den generiske
 * "Familien"-farve.
 *
 * Kun medlemmer med en koblet konto (linked_user_id → users.email, sat via
 * "Min profil" i Indstillinger) kan matches — appen kender ikke en profils
 * e-mail på anden vis, og et barn uden egen konto kan derfor ikke matches
 * denne vej (kalender-tildelingen er stadig den eneste vej for dem).
 */
export function matchAttendeesToOwnerIds(
  attendees: readonly EventAttendee[] | undefined,
  members: readonly CalendarOwner[],
): CalendarOwnerId[] {
  if (!attendees || attendees.length === 0) {
    return [];
  }

  const attendeeEmails = new Set(
    attendees
      .map((attendee) => attendee.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  if (attendeeEmails.size === 0) {
    return [];
  }

  return members
    .filter((member) => member.email && attendeeEmails.has(member.email.trim().toLowerCase()))
    .map((member) => member.id);
}
