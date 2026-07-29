import { calendarEvents } from "../data/calendarEvents";
import type {
  CalendarEvent,
  CalendarOwnerId,
  CalendarWeekday,
  RecurrenceFrequency,
  RecurrenceRule,
} from "../models/calendarEvent";
import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import { getFamilyMemberIds } from "../preferences/familyMembersStorage";
import { deleteRecurrenceExceptionsForMaster } from "../preferences/recurrenceExceptionsStorage";

export type { CreateCalendarEventInput } from "../models/calendarEventInput";

const STORAGE_KEY =
  "boholts-family-calendar-events";

const recurrenceFrequencies: RecurrenceFrequency[] =
  [
    "daily",
    "weekly",
    "monthly",
    "yearly",
  ];

const calendarWeekdays: CalendarWeekday[] = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
];

function createEventId(): string {
  return `event-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isValidDateString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isCalendarOwnerId(
  value: unknown,
): value is CalendarOwnerId {
  return (
    typeof value === "string" &&
    getFamilyMemberIds().includes(value)
  );
}

function isRecurrenceFrequency(
  value: unknown,
): value is RecurrenceFrequency {
  return (
    typeof value === "string" &&
    recurrenceFrequencies.includes(
      value as RecurrenceFrequency,
    )
  );
}

function isCalendarWeekday(
  value: unknown,
): value is CalendarWeekday {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    calendarWeekdays.includes(
      value as CalendarWeekday,
    )
  );
}

function isPositiveInteger(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isRecurrenceRule(
  value: unknown,
): value is RecurrenceRule {
  if (!isObject(value)) {
    return false;
  }

  if (
    !isRecurrenceFrequency(value.frequency) ||
    !isPositiveInteger(value.interval)
  ) {
    return false;
  }

  if (
    value.endType !== "never" &&
    value.endType !== "until" &&
    value.endType !== "count"
  ) {
    return false;
  }

  if (
    value.endType === "until" &&
    !isValidDateString(value.until)
  ) {
    return false;
  }

  if (
    value.endType === "count" &&
    !isPositiveInteger(value.count)
  ) {
    return false;
  }

  if (
    value.until !== undefined &&
    !isValidDateString(value.until)
  ) {
    return false;
  }

  if (
    value.count !== undefined &&
    !isPositiveInteger(value.count)
  ) {
    return false;
  }

  if (
    value.byWeekdays !== undefined &&
    (!Array.isArray(value.byWeekdays) ||
      value.byWeekdays.length === 0 ||
      !value.byWeekdays.every(
        isCalendarWeekday,
      ))
  ) {
    return false;
  }

  if (
    value.byMonthDay !== undefined &&
    !isIntegerInRange(
      value.byMonthDay,
      1,
      31,
    )
  ) {
    return false;
  }

  if (
    value.byMonth !== undefined &&
    !isIntegerInRange(
      value.byMonth,
      1,
      12,
    )
  ) {
    return false;
  }

  return true;
}

function isCalendarEvent(
  value: unknown,
): value is CalendarEvent {
  if (!isObject(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    value.id.trim().length === 0 ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    !isValidDateString(value.start) ||
    !isValidDateString(value.end) ||
    typeof value.allDay !== "boolean" ||
    !Array.isArray(value.ownerIds) ||
    value.ownerIds.length === 0 ||
    !value.ownerIds.every(isCalendarOwnerId) ||
    (value.source !== "internal" &&
      value.source !== "google")
  ) {
    return false;
  }

  if (value.sourceId !== undefined && typeof value.sourceId !== "string") {
    return false;
  }

  if (
    value.description !== undefined &&
    typeof value.description !== "string"
  ) {
    return false;
  }

  if (
    value.location !== undefined &&
    typeof value.location !== "string"
  ) {
    return false;
  }

  if (
    value.color !== undefined &&
    typeof value.color !== "string"
  ) {
    return false;
  }

  if (
    value.recurrence !== undefined &&
    !isRecurrenceRule(value.recurrence)
  ) {
    return false;
  }

  return (
    new Date(value.end).getTime() >
    new Date(value.start).getTime()
  );
}

function validateEventData(
  event: Omit<
    CalendarEvent,
    "id" | "source" | "sourceId"
  >,
): void {
  if (!event.title.trim()) {
    throw new Error(
      "Aftalen skal have en titel.",
    );
  }

  if (!isValidDateString(event.start)) {
    throw new Error(
      "Aftalens starttidspunkt er ugyldigt.",
    );
  }

  if (!isValidDateString(event.end)) {
    throw new Error(
      "Aftalens sluttidspunkt er ugyldigt.",
    );
  }

  if (
    new Date(event.end).getTime() <=
    new Date(event.start).getTime()
  ) {
    throw new Error(
      "Aftalens sluttidspunkt skal ligge efter starttidspunktet.",
    );
  }

  if (event.ownerIds.length === 0) {
    throw new Error(
      "Vælg mindst én deltager.",
    );
  }

  if (
    !event.ownerIds.every(isCalendarOwnerId)
  ) {
    throw new Error(
      "Aftalen indeholder en ukendt deltager.",
    );
  }

  if (
    event.recurrence !== undefined &&
    !isRecurrenceRule(event.recurrence)
  ) {
    throw new Error(
      "Aftalens gentagelsesregel er ugyldig.",
    );
  }

  if (
    event.recurrence?.endType === "until" &&
    event.recurrence.until
  ) {
    const recurrenceEnd = new Date(
      event.recurrence.until,
    ).getTime();

    const eventStart = new Date(
      event.start,
    ).getTime();

    if (recurrenceEnd < eventStart) {
      throw new Error(
        "Gentagelsens slutdato må ikke ligge før aftalens startdato.",
      );
    }
  }
}

function readStoredEvents(): CalendarEvent[] {
  try {
    const storedValue =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown =
      JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isCalendarEvent).map((event) => ({
      ...event,
      sourceId: event.sourceId || `local:${event.ownerIds[0] ?? "family"}`,
    }));
  } catch {
    return [];
  }
}

function saveStoredEvents(
  events: CalendarEvent[],
): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(events),
  );
}

function sortEvents(
  events: CalendarEvent[],
): CalendarEvent[] {
  return [...events].sort(
    (firstEvent, secondEvent) =>
      new Date(
        firstEvent.start,
      ).getTime() -
      new Date(
        secondEvent.start,
      ).getTime(),
  );
}

export class CalendarService {
  static async getEvents(): Promise<
    CalendarEvent[]
  > {
    const storedEvents =
      readStoredEvents();

    return Promise.resolve(
      sortEvents([
        ...calendarEvents,
        ...storedEvents,
      ]),
    );
  }

  static async createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CalendarEvent> {
    validateEventData(input);

    const event: CalendarEvent = {
      id: createEventId(),
      source: "internal",
      sourceId: input.sourceId ?? `local:${input.ownerIds[0] ?? "family"}`,
      ...input,
      title: input.title.trim(),
      description:
        input.description?.trim() ||
        undefined,
      location:
        input.location?.trim() ||
        undefined,
    };

    const storedEvents =
      readStoredEvents();

    saveStoredEvents([
      ...storedEvents,
      event,
    ]);

    return Promise.resolve(event);
  }

  static async updateEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    if (event.source !== "internal") {
      throw new Error(
        "Kun interne aftaler kan redigeres.",
      );
    }

    validateEventData(event);

    const storedEvents =
      readStoredEvents();

    const eventExists =
      storedEvents.some(
        (storedEvent) =>
          storedEvent.id === event.id,
      );

    if (!eventExists) {
      throw new Error(
        "Aftalen blev ikke fundet i lokal lagring.",
      );
    }

    const updatedEvent: CalendarEvent = {
      ...event,
      title: event.title.trim(),
      description:
        event.description?.trim() ||
        undefined,
      location:
        event.location?.trim() ||
        undefined,
    };

    const updatedEvents =
      storedEvents.map(
        (storedEvent) =>
          storedEvent.id === event.id
            ? updatedEvent
            : storedEvent,
      );

    saveStoredEvents(updatedEvents);

    return Promise.resolve(
      updatedEvent,
    );
  }

  static async deleteEvent(
    eventId: string,
  ): Promise<void> {
    const storedEvents =
      readStoredEvents();

    const event = storedEvents.find(
      (storedEvent) =>
        storedEvent.id === eventId,
    );

    if (!event) {
      throw new Error(
        "Aftalen blev ikke fundet i lokal lagring.",
      );
    }

    if (event.source !== "internal") {
      throw new Error(
        "Kun interne aftaler kan slettes.",
      );
    }

    const updatedEvents =
      storedEvents.filter(
        (storedEvent) =>
          storedEvent.id !== eventId,
      );

    saveStoredEvents(updatedEvents);

    // Sletning af en hel gentagelsesrække skal ikke efterlade forældreløse
    // undtagelser (Sprint 16) — de peger på et mester-id, der ikke længere
    // findes.
    if (event.recurrence) {
      deleteRecurrenceExceptionsForMaster(eventId);
    }

    return Promise.resolve();
  }

  static async restoreEvent(
    event: CalendarEvent,
  ): Promise<CalendarEvent> {
    if (event.source !== "internal") {
      throw new Error(
        "Kun interne aftaler kan gendannes.",
      );
    }

    validateEventData(event);

    const storedEvents =
      readStoredEvents();

    const eventAlreadyExists =
      storedEvents.some(
        (storedEvent) =>
          storedEvent.id === event.id,
      );

    if (eventAlreadyExists) {
      throw new Error(
        "Aftalen findes allerede i lokal lagring.",
      );
    }

    saveStoredEvents([
      ...storedEvents,
      event,
    ]);

    return Promise.resolve(event);
  }

  /**
   * Bruges når et familiemedlem slettes (Sprint 15): flytter alle deres
   * lokalt gemte aftaler til et andet medlem (typisk "family") i stedet for
   * at lade dem pege på et medlem, der ikke længere findes. Demo-aftalerne
   * i calendarEvents.ts er statiske og ikke omfattet.
   */
  static async reassignOwner(
    fromOwnerId: string,
    toOwnerId: string,
  ): Promise<void> {
    const storedEvents = readStoredEvents();

    const updatedEvents = storedEvents.map((event) =>
      event.ownerIds.includes(fromOwnerId)
        ? {
            ...event,
            ownerIds: event.ownerIds.map((ownerId) =>
              ownerId === fromOwnerId ? toOwnerId : ownerId,
            ),
          }
        : event,
    );

    saveStoredEvents(updatedEvents);

    return Promise.resolve();
  }
}
