import { calendarOwners } from "../data/calendarOwners";
import type { CalendarOwner } from "../data/calendarOwners";
import { familyPseudoMemberId } from "../models/calendarEvent";
import type { FamilyMemberRelation } from "../data/familyMemberRelations";
import { familyMemberRelations } from "../data/familyMemberRelations";

const STORAGE_KEY = "boholts-family-members";

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
    (candidate.relation === undefined || isValidRelation(candidate.relation))
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
}

export function getFamilyMemberIds(): string[] {
  return getFamilyMembers().map((member) => member.id);
}
