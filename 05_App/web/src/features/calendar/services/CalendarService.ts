import { calendarEvents } from "../data/calendarEvents";
import type {
  CalendarEvent,
  CalendarOwnerId,
} from "../models/calendarEvent";

export interface CreateCalendarEventInput {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  description?: string;
  location?: string;
}

const STORAGE_KEY = "boholts-family-calendar-events";

function createEventId(): string {
  return `event-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const event = value as Partial<CalendarEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    typeof event.start === "string" &&
    typeof event.end === "string" &&
    typeof event.allDay === "boolean" &&
    Array.isArray(event.ownerIds) &&
    event.ownerIds.every(
      (ownerId) => typeof ownerId === "string",
    ) &&
    (event.source === "internal" ||
      event.source === "google")
  );
}

function readStoredEvents(): CalendarEvent[] {
  try {
    const storedValue =
      window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown =
      JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isCalendarEvent);
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
      new Date(firstEvent.start).getTime() -
      new Date(secondEvent.start).getTime(),
  );
}

export class CalendarService {
  static async getEvents(): Promise<CalendarEvent[]> {
    const storedEvents = readStoredEvents();

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
    const event: CalendarEvent = {
      id: createEventId(),
      source: "internal",
      ...input,
    };

    const storedEvents = readStoredEvents();

    saveStoredEvents([
      ...storedEvents,
      event,
    ]);

    return Promise.resolve(event);
  }
}