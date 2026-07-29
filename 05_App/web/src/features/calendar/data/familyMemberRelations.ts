// A shared, named list rather than inline options in the dropdown, so a
// future sprint can make this user-editable without touching every call
// site — same principle as keeping "Familien" as a data field instead of
// a hardcoded string.
export const familyMemberRelations = [
  "Far",
  "Mor",
  "Barn",
  "Andet",
] as const;

export type FamilyMemberRelation = (typeof familyMemberRelations)[number];
