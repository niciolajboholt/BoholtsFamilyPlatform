import type { CalendarEvent } from "../models/calendarEvent";

const STORAGE_KEY = "boholts-family-recurrence-exceptions";

export type RecurrenceExceptionOverride = Partial<
  Pick<
    CalendarEvent,
    | "title"
    | "start"
    | "end"
    | "allDay"
    | "description"
    | "location"
    | "ownerIds"
    | "color"
  >
>;

export interface RecurrenceException {
  masterEventId: string;
  occurrenceStart: string;
  type: "cancelled" | "modified";
  override?: RecurrenceExceptionOverride;
}

function isValidOverride(
  value: unknown,
): value is RecurrenceExceptionOverride {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (candidate.title !== undefined && typeof candidate.title !== "string") {
    return false;
  }

  if (candidate.start !== undefined && typeof candidate.start !== "string") {
    return false;
  }

  if (candidate.end !== undefined && typeof candidate.end !== "string") {
    return false;
  }

  if (
    candidate.allDay !== undefined &&
    typeof candidate.allDay !== "boolean"
  ) {
    return false;
  }

  if (
    candidate.description !== undefined &&
    typeof candidate.description !== "string"
  ) {
    return false;
  }

  if (
    candidate.location !== undefined &&
    typeof candidate.location !== "string"
  ) {
    return false;
  }

  if (
    candidate.ownerIds !== undefined &&
    (!Array.isArray(candidate.ownerIds) ||
      !candidate.ownerIds.every((ownerId) => typeof ownerId === "string"))
  ) {
    return false;
  }

  if (candidate.color !== undefined && typeof candidate.color !== "string") {
    return false;
  }

  return true;
}

function isValidException(value: unknown): value is RecurrenceException {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.masterEventId !== "string" ||
    candidate.masterEventId.trim().length === 0 ||
    typeof candidate.occurrenceStart !== "string" ||
    candidate.occurrenceStart.trim().length === 0
  ) {
    return false;
  }

  if (candidate.type !== "cancelled" && candidate.type !== "modified") {
    return false;
  }

  if (
    candidate.override !== undefined &&
    !isValidOverride(candidate.override)
  ) {
    return false;
  }

  return true;
}

function readStoredExceptions(): RecurrenceException[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return [];
    }

    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidException);
  } catch {
    return [];
  }
}

function saveStoredExceptions(exceptions: RecurrenceException[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exceptions));
  } catch {
    // Storage may be unavailable (private browsing, disabled storage) —
    // the caller's in-memory state remains correct for this session.
  }
}

export function getRecurrenceExceptions(): RecurrenceException[] {
  return readStoredExceptions();
}

export function upsertRecurrenceException(
  masterEventId: string,
  occurrenceStart: string,
  exception: Omit<RecurrenceException, "masterEventId" | "occurrenceStart">,
): RecurrenceException[] {
  const stored = readStoredExceptions();

  const nextException: RecurrenceException = {
    masterEventId,
    occurrenceStart,
    ...exception,
  };

  const updated = [
    ...stored.filter(
      (existing) =>
        !(
          existing.masterEventId === masterEventId &&
          existing.occurrenceStart === occurrenceStart
        ),
    ),
    nextException,
  ];

  saveStoredExceptions(updated);

  return updated;
}

export function deleteRecurrenceExceptionsForMaster(
  masterEventId: string,
): RecurrenceException[] {
  const stored = readStoredExceptions();

  const updated = stored.filter(
    (exception) => exception.masterEventId !== masterEventId,
  );

  saveStoredExceptions(updated);

  return updated;
}
