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

// Sprint 57-opfølgning (reviewfund): kaldes BÅDE efter almindelige
// læsninger/synk (fx AppLayout's "hold pseudomedlemmets server-id varmt"-
// effekt ved hver sideindlæsning) og efter reelle mutationer (tilføj/
// redigér/slet medlem, opret/tilslut familie) — invaliderer derfor
// bevidst IKKE selv familySessionCache her. Ville den gøre det, ville
// AppLayouts helt almindelige, hyppige læse-kald ødelægge den cache, det
// samme kald netop havde udfyldt, praktisk talt med det samme (cachen
// ville reelt aldrig leve i det tilsigtede 30-sekunders TTL-vindue).
// Kaldesteder, der udfører en REEL mutation, kalder selv
// invalidateFamilyCache() ved siden af (se useFamilyMembers.ts og
// FamilySetupOnboarding.tsx).
export function syncFamilyMembersFromServer(members: FamilyMemberDto[]): void {
  const pseudoMember = members.find((member) => member.relation === null);
  setFamilyPseudoMemberServerId(pseudoMember?.id ?? null);
  saveFamilyMembers(mapMembersToCalendarOwners(members));
}
