export type CalendarProviderType =
  | "local"
  | "google"
  | "apple";

/**
 * En leverandøruafhængig kalenderkilde.
 *
 * `externalReference` bruges kun af provider-laget til senere synkronisering
 * og må ikke behandles som en Google- eller Apple-identitet i UI-laget.
 */
export interface CalendarSource {
  id: string;
  name: string;
  providerType: CalendarProviderType;
  color: string;
  isVisible: boolean;
  isReadOnly: boolean;
  ownerId?: string;
  externalReference?: string;
}

export interface CalendarEventRange {
  start: string;
  end: string;
}

export const allCalendarEventRange: CalendarEventRange = {
  start: "-271821-04-20T00:00:00.000Z",
  end: "+275760-09-13T00:00:00.000Z",
};
