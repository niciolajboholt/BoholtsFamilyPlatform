import { calendarEvents } from "../data/calendarEvents";
import type { CalendarEvent } from "../models/calendarEvent";

export class CalendarService {
  static async getEvents(): Promise<CalendarEvent[]> {
    return Promise.resolve(calendarEvents);
  }
}