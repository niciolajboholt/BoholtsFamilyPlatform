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
  /**
   * Fase 8: sat når status er "ready", men de viste aftaler kommer fra en
   * lokal offline-fallback (enheden er offline) i stedet for en frisk
   * hentning — ISO-tidsstempel for hvor gammel den cache er.
   */
  staleDataAsOf?: string;
}
