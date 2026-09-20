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

// Sprint 57: den ENESTE kanoniske "er dette en børneprofil"-markør —
// bruges til at afgøre, om børneadgang/beskeder skal tilbydes for et
// medlem. Matcher server-siden (childAccessManagement.ts,
// childMessages.ts), som håndhæver det samme, så en skjult UI-sektion
// aldrig kan omgås via et direkte API-kald.
export function isChildRelation(relation: string | null): boolean {
  return relation === "Barn";
}
