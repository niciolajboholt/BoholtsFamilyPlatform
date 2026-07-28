import { calendarOwners } from "./calendarOwners";
import type { CalendarSource } from "../models/calendarProvider";

const ownerCalendarSources: CalendarSource[] = Object.values(
  calendarOwners,
).map((owner) => ({
  id: `local:${owner.id}`,
  name: owner.name,
  providerType: "local",
  color: owner.color,
  isVisible: true,
  isReadOnly: false,
  ownerId: owner.id,
}));

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

export const localCalendarSources: CalendarSource[] = [
  ...ownerCalendarSources,
  legacyGoogleDemoSource,
];
