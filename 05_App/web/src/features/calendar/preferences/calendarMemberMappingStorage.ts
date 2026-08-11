import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarOwnerId } from "../models/calendarEvent";

/**
 * Kobler en rå Google-kalender-id til et familiemedlem, så aftaler fra en
 * delt/personlig Google-kalender (fx "Familien Boholt" eller Nicolajs egen
 * kalender) arver medlemmets farve og indgår i familiefiltrering, i stedet
 * for at fremstå som en generisk, Google-farvet kilde. Se ADR-014.
 *
 * Gemmes pr. enhed, ligesom `calendarSourceVisibilityStorage` — hvert
 * familiemedlem sætter denne op én gang på sin egen telefon/computer.
 */
const STORAGE_KEY = "boholts-family-calendar-member-mapping";

interface StoredMapping {
  googleCalendarId: string;
  ownerId: CalendarOwnerId;
}

function isStoredMapping(value: unknown): value is StoredMapping {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoredMapping>;

  return (
    typeof candidate.googleCalendarId === "string" &&
    candidate.googleCalendarId.length > 0 &&
    typeof candidate.ownerId === "string" &&
    candidate.ownerId.length > 0
  );
}

function readMappings(): StoredMapping[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) && parsed.every(isStoredMapping)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function writeMappings(mappings: StoredMapping[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

/**
 * Alle tildelinger som et opslagsobjekt: rå Google-kalender-id → familiemedlem-id.
 */
export function getCalendarMemberMappings(): Record<string, CalendarOwnerId> {
  const mappings: Record<string, CalendarOwnerId> = {};

  for (const entry of readMappings()) {
    mappings[entry.googleCalendarId] = entry.ownerId;
  }

  return mappings;
}

// Navnet er en rest fra før Outlook fandtes (Sprint 14) — virker fint for
// enhver providers rå kalender-id, ikke kun Google's, da mappingen selv er
// providerneutral. Ikke omdøbt endnu for at undgå at røre 8 filer for en
// navne-detalje alene.
export function getOwnerIdForGoogleCalendar(
  googleCalendarId: string,
): CalendarOwnerId | undefined {
  return readMappings().find(
    (entry) => entry.googleCalendarId === googleCalendarId,
  )?.ownerId;
}

/**
 * Modsat opslag af getOwnerIdForGoogleCalendar — bruges af
 * FamilyMemberDialog til at forududfylde, hvilken kalender et medlem allerede
 * har. Et medlem kan i princippet have flere kalendere mappet til sig, men
 * dialogen tilbyder kun at vise/redigere én ad gangen — den først fundne.
 */
export function getCalendarIdForOwner(
  ownerId: CalendarOwnerId,
): string | undefined {
  return readMappings().find((entry) => entry.ownerId === ownerId)
    ?.googleCalendarId;
}

/**
 * Samme tildelinger som getCalendarMemberMappings(), men slået op til de
 * faktiske familiemedlem-objekter (navn, farve) i stedet for bare id'er —
 * delt af Google- og Outlook-provideren, som ellers hver havde en identisk
 * kopi af denne udledning.
 */
export function getMappedOwnersByCalendarId(
  members: CalendarOwner[],
): Map<string, CalendarOwner> {
  const mappings = getCalendarMemberMappings();
  const membersById = new Map(members.map((member) => [member.id, member]));
  const result = new Map<string, CalendarOwner>();

  for (const [calendarId, ownerId] of Object.entries(mappings)) {
    const member = membersById.get(ownerId);
    if (member) result.set(calendarId, member);
  }

  return result;
}

/**
 * Sætter eller fjerner (ved `ownerId: null`) tildelingen for én kalender.
 */
export function setCalendarMemberMapping(
  googleCalendarId: string,
  ownerId: CalendarOwnerId | null,
): void {
  const withoutExisting = readMappings().filter(
    (entry) => entry.googleCalendarId !== googleCalendarId,
  );

  writeMappings(
    ownerId
      ? [...withoutExisting, { googleCalendarId, ownerId }]
      : withoutExisting,
  );
}

/**
 * Ryddes ved eksplicit afbrydelse — en senere (gen)forbindelse, evt. med en
 * anden Google-konto, bør starte forfra, ikke arve tildelinger der pegede på
 * en tidligere kontos kalender-id'er.
 */
export function clearCalendarMemberMappings(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
