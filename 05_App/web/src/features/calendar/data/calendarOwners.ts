import type { CalendarOwnerId } from "../models/calendarEvent";
import type { FamilyMemberRelation } from "./familyMemberRelations";

export interface CalendarOwner {
  id: CalendarOwnerId;
  name: string;
  color: string;
  relation?: FamilyMemberRelation;
}

// Seed/default data only — the runtime source of truth is the dynamic,
// user-editable list from familyMembersStorage.ts (Sprint 15). This is
// used purely as the initial fallback for a first-time user.
export const calendarOwners: Record<CalendarOwnerId, CalendarOwner> = {
  nicolaj: {
    id: "nicolaj",
    name: "Nicolaj",
    color: "#2E7D32",
    relation: "Far",
  },
  christine: {
    id: "christine",
    name: "Christine",
    color: "#C06C84",
    relation: "Mor",
  },
  alfred: {
    id: "alfred",
    name: "Alfred",
    color: "#D99832",
    relation: "Barn",
  },
  jens: {
    id: "jens",
    name: "Jens",
    color: "#4D7EA8",
    relation: "Barn",
  },
  family: {
    id: "family",
    name: "Familien",
    color: "#6D597A",
  },
};