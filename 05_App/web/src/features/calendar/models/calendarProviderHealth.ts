import type { CalendarProviderType } from "./calendarProvider";

export type CalendarProviderStatus =
  | "disabled"
  | "disconnected"
  | "connecting"
  | "loading"
  | "ready"
  | "error";

export interface CalendarProviderHealth {
  providerId: CalendarProviderType;
  status: CalendarProviderStatus;
  message?: string;
  canRetry?: boolean;
}
