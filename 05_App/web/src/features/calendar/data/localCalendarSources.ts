import { getFamilyMembers } from "../preferences/familyMembersStorage";
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
  const ownerCalendarSources: CalendarSource[] = getFamilyMembers().map(
    (owner) => ({
      id: `local:${owner.id}`,
      name: owner.name,
      providerType: "local",
      color: owner.color,
      isVisible: true,
      isReadOnly: false,
      ownerId: owner.id,
    }),
  );

  return [...ownerCalendarSources, legacyGoogleDemoSource];
}
