import { useMemo } from "react";

import type { CalendarEvent } from "../models/calendarEvent";
import {
  findEventConflicts,
  type EventConflictCandidate,
} from "../utils/findEventConflicts";
import {
  createAllDayDate,
  createDateTime,
} from "./eventFormDateUtils";
import type { EventFormState } from "./eventFormTypes";

interface UseEventConflictsOptions {
  form: EventFormState;
  events: CalendarEvent[];
  validationError: string | null;
  excludedEventId?: string;
  isEnabled?: boolean;
}

export interface UseEventConflictsResult {
  candidateEvent: EventConflictCandidate | null;
  conflicts: CalendarEvent[];
}

export function useEventConflicts({
  form,
  events,
  validationError,
  excludedEventId,
  isEnabled = true,
}: UseEventConflictsOptions): UseEventConflictsResult {
  const candidateEvent = useMemo(() => {
    if (
      !form.startDate ||
      !form.endDate ||
      form.ownerIds.length === 0 ||
      validationError
    ) {
      return null;
    }

    return {
      start: form.allDay
        ? createAllDayDate(
            form.startDate,
            false,
          )
        : createDateTime(
            form.startDate,
            form.startTime,
          ),
      end: form.allDay
        ? createAllDayDate(
            form.endDate,
            true,
          )
        : createDateTime(
            form.endDate,
            form.endTime,
          ),
      ownerIds: form.ownerIds,
    } satisfies EventConflictCandidate;
  }, [form, validationError]);

  const conflicts = useMemo(() => {
    if (!candidateEvent || !isEnabled) {
      return [];
    }

    return findEventConflicts(
      candidateEvent,
      events,
      excludedEventId,
    );
  }, [candidateEvent, events, excludedEventId, isEnabled]);

  return {
    candidateEvent,
    conflicts,
  };
}
