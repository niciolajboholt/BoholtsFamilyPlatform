import type { CalendarOwnerId } from "../models/calendarEvent";
import type { FamilyMemberRelation } from "./familyMemberRelations";

export interface CalendarOwner {
  id: CalendarOwnerId;
  name: string;
  color: string;
  relation?: FamilyMemberRelation;
  // True while the name is still the generic onboarding default, never
  // deliberately chosen by the user — lets later flows (e.g. mapping a
  // Google calendar to this member) offer to replace it with a real name
  // instead of silently overwriting something the user already picked.
  isPlaceholderName?: boolean;
}

// Seed/default data only — the runtime source of truth is the dynamic,
// user-editable list from familyMembersStorage.ts (Sprint 15). Generic
// placeholders (Sprint 17) rather than a real family's names, since a
// brand-new installation falls back to this before onboarding runs.
export const calendarOwners: Record<CalendarOwnerId, CalendarOwner> = {
  far: {
    id: "far",
    name: "Far",
    color: "#2E7D32",
    relation: "Far",
    isPlaceholderName: true,
  },
  mor: {
    id: "mor",
    name: "Mor",
    color: "#C06C84",
    relation: "Mor",
    isPlaceholderName: true,
  },
  "barn-1": {
    id: "barn-1",
    name: "Barn 1",
    color: "#D99832",
    relation: "Barn",
    isPlaceholderName: true,
  },
  "barn-2": {
    id: "barn-2",
    name: "Barn 2",
    color: "#4D7EA8",
    relation: "Barn",
    isPlaceholderName: true,
  },
  family: {
    id: "family",
    name: "Familien",
    color: "#6D597A",
    isPlaceholderName: true,
  },
};