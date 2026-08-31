// Family members are dynamic, user-managed data (see useFamilyMembers /
// familyMembersStorage) — not a fixed set known at compile time. "family"
// remains a reserved id for the shared/whole-family pseudo-member.
export type CalendarOwnerId = string;

export const familyPseudoMemberId: CalendarOwnerId = "family";

export type CalendarEventSource =
  | "internal"
  | "google"
  | "outlook"
  | "ics";

// Mirrors isExternalCalendarProviderType (models/calendarProvider.ts) at the
// event level — ejerskab på eksterne aftaler kommer fra kalender-til-
// familiemedlem-tildelingen, ikke manuel valg.
export function isExternalCalendarEventSource(
  source: CalendarEventSource,
): boolean {
  return source === "google" || source === "outlook" || source === "ics";
}

export type CalendarSourceId = string;

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

/**
 * Kun relevant for `frequency: "monthly"`.
 *
 * dayOfMonth = samme datotal hver måned (fx "den 15."), styret af byMonthDay
 * dayOfWeek  = en bestemt ugedag i en bestemt position, styret af
 *              byOrdinalWeekday (fx "den 3. mandag" eller "sidste fredag")
 */
export type RecurrenceMonthlyPattern =
  | "dayOfMonth"
  | "dayOfWeek";

/**
 * Position for en ugedag inden for måneden.
 *
 * 1-4 = første til fjerde forekomst
 * -1  = sidste forekomst
 */
export type WeekdayOrdinal =
  | 1
  | 2
  | 3
  | 4
  | -1;

export interface OrdinalWeekday {
  /**
   * Én eller flere positioner for samme ugedag — fx `[1, -1]` for "første og
   * sidste fredag i måneden". De fleste mønstre bruger kun én position.
   */
  ordinals: WeekdayOrdinal[];
  weekday: CalendarWeekday;
}

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
   * Styrer, hvilket månedligt mønster der bruges — kun relevant, når
   * frequency er "monthly". Udelades/"dayOfMonth" betyder byMonthDay.
   */
  monthlyPattern?: RecurrenceMonthlyPattern;

  /**
   * Ugedag-i-position for månedlig gentagelse, når monthlyPattern er
   * "dayOfWeek" (fx "den 3. mandag" eller "sidste fredag").
   */
  byOrdinalWeekday?: OrdinalWeekday;

  /**
   * Månedsdag for månedlige gentagelser, når monthlyPattern er "dayOfMonth"
   * (eller udeladt).
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
  source: CalendarEventSource;
  sourceId: CalendarSourceId;
  location?: string;

  /**
   * En kildes egen farve, brugt som fald-tilbage af getEventOwnerColor(),
   * når aftalen ikke har noget matchet familiemedlem-ejerskab (ownerIds er
   * tom) — fx et ICS-abonnement uden medlemstilknytning, som stadig har sin
   * egen valgte farve (se icsCalendarMapper.ts). Ikke sat af Google/Outlook-
   * mapperne, da de altid har enten et medlem- eller intet ejerskab, aldrig
   * en tredje "kilde-egen" farve at falde tilbage på.
   */
  color?: string;

  /** Private provider-aftaler vises kun med detaljer for den kortlagte ejer. */
  privacy?: "busy";

  /** Sat på en visningskopi, hvor titel/beskrivelse/lokation er redigeret. */
  privacyRedacted?: boolean;

  /**
   * Findes kun, hvis aftalen gentages.
   *
   * En aftale uden recurrence er en almindelig enkeltstående aftale.
   */
  recurrence?: RecurrenceRule;

  /**
   * Sat udelukkende på afledte forekomster af en gentagen aftale (aldrig på
   * selve den lagrede/mester-aftale). Peger på mester-aftalens id — lokalt
   * (expandRecurringEvents) eller Google (event.recurringEventId).
   */
  recurrenceMasterId?: string;

  /**
   * Sat udelukkende på afledte forekomster. Forekomstens oprindelige,
   * uændrede starttidspunkt — bruges som nøgle til undtagelser, selv hvis
   * forekomstens faktiske tid efterfølgende er ændret.
   */
  recurrenceOccurrenceStart?: string;
}
