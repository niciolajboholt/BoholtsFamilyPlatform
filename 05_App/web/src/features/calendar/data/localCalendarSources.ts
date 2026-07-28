import { calendarOwners } from "./calendarOwners";
import type { CalendarSource } from "../models/calendarProvider";

export const localCalendarSources: CalendarSource[] = Object.values(
  calendarOwners,
).map((owner) => ({
  id: owner.id,
  name: owner.name,
  providerType: "local",
  color: owner.color,
  isVisible: true,
  isReadOnly: false,
  ownerId: owner.id,
}));
