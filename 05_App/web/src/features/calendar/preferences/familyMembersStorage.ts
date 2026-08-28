import { calendarOwners } from "../data/calendarOwners";
import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { FamilyMemberRelation } from "../data/familyMemberRelations";
import { familyMemberRelations } from "../data/familyMemberRelations";

const STORAGE_KEY = "boholts-family-members";

// useFamilyMembers() isn't a shared Context — each component instance has
// its own useState, only synced via localStorage. Components that derive
// something from family data OUTSIDE that hook (e.g. AppLayout's AppBar
// heading) need this event to notice a save from elsewhere in the app.
export const familyMembersChangedEvent = "boholts-family-members-changed";

function seedMembers(): CalendarOwner[] {
  return Object.values(calendarOwners);
}

function isValidRelation(
  value: unknown,
): value is FamilyMemberRelation {
  return (
    typeof value === "string" &&
    (familyMemberRelations as readonly string[]).includes(value)
  );
}

function isValidMember(value: unknown): value is CalendarOwner {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.color === "string" &&
    (candidate.relation === undefined || isValidRelation(candidate.relation)) &&
    (candidate.isPlaceholderName === undefined ||
      typeof candidate.isPlaceholderName === "boolean") &&
    (candidate.email === undefined || typeof candidate.email === "string")
  );
}

function readStoredMembers(): CalendarOwner[] | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return null;
    }

    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed) || !parsed.every(isValidMember)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getFamilyMembers(): CalendarOwner[] {
  const stored = readStoredMembers();

  if (stored && stored.some((member) => member.id === familyPseudoMemberId)) {
    return stored;
  }

  // Defensive: "family" must always exist, even if storage was somehow
  // saved without it — every event can fall back to it.
  if (stored) {
    return [...stored, calendarOwners[familyPseudoMemberId]];
  }

  return seedMembers();
}

export function saveFamilyMembers(members: CalendarOwner[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch {
    // Storage may be unavailable (private browsing, disabled storage) —
    // the caller's in-memory state remains correct for this session.
  }

  window.dispatchEvent(new Event(familyMembersChangedEvent));
}

export function getFamilyMemberIds(): string[] {
  return getFamilyMembers().map((member) => member.id);
}

// familyMembersSync.ts erstatter familie-pseudomedlemmets rigtige
// server-side id (en crypto.randomUUID(), som enhver anden familys) med det
// faste, lokale familyPseudoMemberId ("family"), som resten af appen altid
// har forventet. Det er praktisk for lokal visning/filtrering, men betyder
// at det rigtige server-id ellers går tabt — og et hvilket som helst senere
// server-kald, der skal identificere pseudomedlemmet over for API'et (fx
// Fase 4's kalender-medlem-tildeling), ville sende "family" i stedet for et
// gyldigt id og blive afvist. Denne cache er broen: sat af
// syncFamilyMembersFromServer, læst af alt der taler direkte med serveren
// om pseudomedlemmet.
let cachedFamilyPseudoMemberServerId: string | null = null;

export function setFamilyPseudoMemberServerId(id: string | null): void {
  cachedFamilyPseudoMemberServerId = id;
}

export function getFamilyPseudoMemberServerId(): string | null {
  return cachedFamilyPseudoMemberServerId;
}

// A brand-new install never has this key written yet — this is also, by
// construction, the "has the user completed first-launch onboarding?"
// signal (Sprint 17), since onboarding's only job is to write it for the
// first time (whether via the real form or "Spring over").
export function hasCompletedFamilySetup(): boolean {
  return readStoredMembers() !== null;
}

// Fase 2: kaldes ved log ud, så en anden bruger, der logger ind på samme
// enhed bagefter, ikke arver den forrige brugers familie fra den lokale
// cache — uden dette ville hasCompletedFamilySetup() stadig være sand, og
// AppLayout ville aldrig spørge serveren om den nye brugers egen familie.
export function clearFamilyMembers(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage utilgængelig — intet at rydde.
  }

  window.dispatchEvent(new Event(familyMembersChangedEvent));
}
