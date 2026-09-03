import type {
  CalendarOwnerId,
  RecurrenceRule,
} from "./calendarEvent";

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  sourceId?: string;
  description?: string;
  location?: string;
  recurrence?: RecurrenceRule;
  privacy?: "busy";

  /**
   * Kun relevant for Google (Sprint 36) — sætter et manuelt familiemedlem-
   * ejerskab på den nye aftale via Googles extendedProperties, for et
   * medlem uden egen konto/kalender (fx et barn), som deltager-/kalender-
   * match ikke kan nå. Se ownerIdsOverride på CalendarEvent og
   * googleCalendarWriteMapper.ts.
   */
  ownerIdsOverride?: CalendarOwnerId[];
}
