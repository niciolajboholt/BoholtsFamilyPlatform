// Bro mellem den server-ejede familie (Fase 2) og den eksisterende,
// synkrone localStorage-baserede familyMembersStorage.ts, som resten af
// appen (kalendervisninger, farver, dashboard) allerede læser fra overalt.
// I stedet for at gøre hver eneste af de forbrugere async, henter vi
// familiens medlemmer fra serveren ved login/familie-skift og skriver dem
// ind i den samme lokale cache via den eksisterende saveFamilyMembers().
import type { CalendarOwner } from "../calendar/data/calendarOwners";
import { familyPseudoMemberId } from "../calendar/models/calendarEvent";
import {
  saveFamilyMembers,
  setFamilyPseudoMemberServerId,
} from "../calendar/preferences/familyMembersStorage";
import type { FamilyMemberDto } from "./familyApi";
import { invalidateFamilyCache } from "./familySessionCache";

// relation=NULL er reserveret til familie-pseudomedlemmet på serveren — det
// er sådan vi genkender netop den række og giver den det id, resten af
// appen forventer ("family"), uafhængigt af dens rigtige database-id.
export function mapMembersToCalendarOwners(
  members: FamilyMemberDto[],
): CalendarOwner[] {
  return members.map((member) => ({
    id: member.relation === null ? familyPseudoMemberId : member.id,
    name: member.name,
    color: member.color,
    relation:
      member.relation === null
        ? undefined
        : (member.relation as CalendarOwner["relation"]),
    isPlaceholderName: member.isPlaceholderName === 1,
    email: member.linkedUserEmail ?? undefined,
  }));
}

export function syncFamilyMembersFromServer(members: FamilyMemberDto[]): void {
  const pseudoMember = members.find((member) => member.relation === null);
  setFamilyPseudoMemberServerId(pseudoMember?.id ?? null);
  saveFamilyMembers(mapMembersToCalendarOwners(members));
  // Sprint 57: dette er allerede det eksisterende, centrale signal for
  // "familiens medlemmer ændrede sig" (kaldt efter enhver
  // tilføjelse/redigering/sletning, se useFamilyMembers.ts) — genbruges
  // derfor også til at invalidere getCachedFamily()'s delte cache.
  invalidateFamilyCache();
}
