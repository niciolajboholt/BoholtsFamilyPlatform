import { getFamilyMembers } from "../preferences/familyMembersStorage";
import { getCalendarMemberMappings } from "../preferences/calendarMemberMappingStorage";
import type { CalendarSource } from "../models/calendarProvider";

/**
 * Den historiske demoaftale med `source: "google"` bevares som en skrivebeskyttet
 * kilde, indtil en bruger forbinder sin egen Google-konto. Det sikrer, at den
 * eksisterende demo ikke forsvinder ved overgangen til sourceId-filtrering.
 */
const legacyGoogleDemoSource: CalendarSource = {
  id: "google:demo",
  name: "Google Kalender",
  providerType: "google",
  color: "#607d8b",
  isVisible: true,
  isReadOnly: true,
  externalReference: "demo",
};

// Computed per call, not once at module load — family members are now
// dynamic (Sprint 15), so a newly added/removed member must be reflected
// immediately without a full page reload.
export function getLocalCalendarSources(): CalendarSource[] {
  // Et familiemedlem, hvis kalender er tildelt til en rigtig Google-kalender
  // (ADR-014), skal ikke også vise en tom, lokal duplikat-kalender ved siden
  // af — den lokale kilde skjules, så der kun er ét, Google-forankret
  // kalenderelement pr. medlem.
  const mappedOwnerIds = new Set(
    Object.values(getCalendarMemberMappings()),
  );

  const ownerCalendarSources: CalendarSource[] = getFamilyMembers()
    .filter((owner) => !mappedOwnerIds.has(owner.id))
    .map((owner) => ({
      id: `local:${owner.id}`,
      name: owner.name,
      providerType: "local",
      color: owner.color,
      isVisible: true,
      isReadOnly: false,
      ownerId: owner.id,
    }));

  return [...ownerCalendarSources, legacyGoogleDemoSource];
}
