import { calendarEvents } from "../data/calendarEvents";
import type { CalendarEvent } from "../models/calendarEvent";

export class CalendarService {
  static getEvents(): CalendarEvent[] {
    return calendarEvents;
  }
}