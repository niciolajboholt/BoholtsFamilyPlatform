export type CalendarOwnerId =
  | "nicolaj"
  | "christine"
  | "alfred"
  | "jens"
  | "family";

export type CalendarSource =
  | "internal"
  | "google";

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type CalendarWeekday =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;

export type RecurrenceEndType =
  | "never"
  | "until"
  | "count";

export interface RecurrenceRule {
  /**
   * Hvor ofte aftalen gentages.
   *
   * daily   = dagligt
   * weekly  = ugentligt
   * monthly = månedligt
   * yearly  = årligt
   */
  frequency: RecurrenceFrequency;

  /**
   * Intervallet mellem gentagelser.
   *
   * Eksempler:
   * 1 = hver uge
   * 2 = hver anden uge
   * 3 = hver tredje måned
   */
  interval: number;

  /**
   * Hvordan serien afsluttes.
   *
   * never = ingen slutdato
   * until = afslut på en bestemt dato
   * count = afslut efter et bestemt antal forekomster
   */
  endType: RecurrenceEndType;

  /**
   * Sidste tilladte startdato for en forekomst.
   *
   * Bruges kun, når endType er "until".
   */
  until?: string;

  /**
   * Samlet antal forekomster inklusive den oprindelige aftale.
   *
   * Bruges kun, når endType er "count".
   */
  count?: number;

  /**
   * Ugedage for ugentlige gentagelser.
   *
   * JavaScript-format:
   * 0 = søndag
   * 1 = mandag
   * 2 = tirsdag
   * 3 = onsdag
   * 4 = torsdag
   * 5 = fredag
   * 6 = lørdag
   */
  byWeekdays?: CalendarWeekday[];

  /**
   * Månedsdag for månedlige gentagelser.
   *
   * Eksempel:
   * 15 = den 15. i måneden
   */
  byMonthDay?: number;

  /**
   * Måned for årlige gentagelser.
   *
   * 1 = januar
   * 12 = december
   */
  byMonth?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  ownerIds: CalendarOwnerId[];
  source: CalendarSource;
  location?: string;
  color?: string;

  /**
   * Findes kun, hvis aftalen gentages.
   *
   * En aftale uden recurrence er en almindelig enkeltstående aftale.
   */
  recurrence?: RecurrenceRule;
}