import type { CalendarOwner } from "../data/calendarOwners";
import type { CalendarOwnerId } from "../models/calendarEvent";
import {
  clearAllCalendarMappings,
  deleteCalendarMapping,
  getCalendarMappings,
  getMyFamily,
  setCalendarMapping,
} from "../../family/familyApi";

/**
 * Kobler en rå Google-kalender-id til et familiemedlem, så aftaler fra en
 * delt/personlig Google-kalender (fx "Familien Boholt" eller Nicolajs egen
 * kalender) arver medlemmets farve og indgår i familiefiltrering, i stedet
 * for at fremstå som en generisk, Google-farvet kilde. Se ADR-014.
 *
 * Fase 4: tildelingen er familiedata og ejes af serveren — men de fleste
 * opslag herfra (getCalendarMemberMappings m.fl.) er meget hyppige og bruges
 * synkront af provider-laget, så de bliver ved med at læse en lokal cache i
 * stedet for at blive gjort async overalt. refreshCalendarMemberMappingsFromServer()
 * er broen: kaldes af provider-laget før det læser cachen, så den altid er
 * frisk — samme mønster som familyMembersSync.ts bruger for familyMembersStorage.ts.
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

// familyId ændrer sig ikke midt i en session — slås kun op én gang, i
// stedet for at kalde /api/families/mine ved hver eneste kalender-hentning.
let cachedFamilyId: string | null | undefined;

async function resolveFamilyId(): Promise<string | null> {
  if (cachedFamilyId !== undefined) {
    return cachedFamilyId;
  }

  const result = await getMyFamily();
  cachedFamilyId = result.ok && result.data.family ? result.data.family.id : null;
  return cachedFamilyId;
}

function toStoredMappings(
  rows: { googleCalendarId: string; familyMemberId: string }[],
): StoredMapping[] {
  return rows.map((row) => ({
    googleCalendarId: row.googleCalendarId,
    ownerId: row.familyMemberId as CalendarOwnerId,
  }));
}

/**
 * Henter familiens tildelinger fra serveren og skriver dem ind i den lokale
 * cache — kaldes af provider-laget (GoogleCalendarProvider m.fl.), før det
 * læser mappings synkront, så cachen altid er frisk.
 */
export async function refreshCalendarMemberMappingsFromServer(): Promise<void> {
  const familyId = await resolveFamilyId();

  if (!familyId) {
    return;
  }

  const result = await getCalendarMappings(familyId);

  if (result.ok && result.data.mappings) {
    writeMappings(toStoredMappings(result.data.mappings));
  }
}

/**
 * Sætter eller fjerner (ved `ownerId: null`) tildelingen for én kalender.
 * Server-først, ligesom useFamilyMembers.ts's mutationer — cachen opdateres
 * kun fra serverens eget, autoritative svar, ikke optimistisk.
 */
export async function setCalendarMemberMapping(
  googleCalendarId: string,
  ownerId: CalendarOwnerId | null,
): Promise<void> {
  const familyId = await resolveFamilyId();

  if (!familyId) {
    return;
  }

  const result = ownerId
    ? await setCalendarMapping(familyId, googleCalendarId, ownerId)
    : await deleteCalendarMapping(familyId, googleCalendarId);

  if (result.ok && result.data.mappings) {
    writeMappings(toStoredMappings(result.data.mappings));
  }
}

/**
 * Ryddes ved eksplicit afbrydelse — en senere (gen)forbindelse, evt. med en
 * anden Google-konto, bør starte forfra, ikke arve tildelinger der pegede på
 * en tidligere kontos kalender-id'er. Rydder familiens delte data på
 * serveren, ikke kun denne enheds cache.
 */
export async function clearCalendarMemberMappings(): Promise<void> {
  const familyId = await resolveFamilyId();

  if (!familyId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const result = await clearAllCalendarMappings(familyId);

  if (result.ok) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
