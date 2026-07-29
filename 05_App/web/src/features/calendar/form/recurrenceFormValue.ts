import type {
  CalendarWeekday,
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurrenceMonthlyPattern,
  RecurrenceRule,
  WeekdayOrdinal,
} from "../models/calendarEvent";

export type RecurrencePresetOption =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom";

// "firstAndLast" er et UI-bekvemmeligheds-valg — det udfoldes til
// ordinals: [1, -1] på selve reglen, ikke en separat model-koncept.
export type OrdinalSelection = WeekdayOrdinal | "firstAndLast";

export interface RecurrenceFormValue {
  frequency: RecurrenceFrequency | "none";
  interval: number;
  byWeekdays: CalendarWeekday[];
  monthlyPattern: RecurrenceMonthlyPattern;
  byMonthDay: number;
  ordinal: OrdinalSelection;
  ordinalWeekday: CalendarWeekday;
  endType: RecurrenceEndType;
  until: string;
  count: number;
}

export const defaultRecurrenceFormValue: RecurrenceFormValue = {
  frequency: "none",
  interval: 1,
  byWeekdays: [],
  monthlyPattern: "dayOfMonth",
  byMonthDay: 1,
  ordinal: 1,
  ordinalWeekday: 1,
  endType: "never",
  until: "",
  count: 1,
};

// Mandag-først rækkefølge (til visning) — modellens CalendarWeekday bruger
// JavaScripts søndag-først-nummerering (0 = søndag).
export const weekdayDisplayOrder: CalendarWeekday[] = [1, 2, 3, 4, 5, 6, 0];

export const weekdayShortLabels: Record<CalendarWeekday, string> = {
  0: "S",
  1: "M",
  2: "T",
  3: "O",
  4: "T",
  5: "F",
  6: "L",
};

export const weekdayFullNames: Record<CalendarWeekday, string> = {
  0: "søndag",
  1: "mandag",
  2: "tirsdag",
  3: "onsdag",
  4: "torsdag",
  5: "fredag",
  6: "lørdag",
};

const weekdayAbbreviations: Record<CalendarWeekday, string> = {
  0: "søn",
  1: "man",
  2: "tir",
  3: "ons",
  4: "tor",
  5: "fre",
  6: "lør",
};

export const weekdayOrdinalOptions: OrdinalSelection[] = [
  1,
  2,
  3,
  4,
  -1,
  "firstAndLast",
];

export const weekdayOrdinalLabels: Record<OrdinalSelection, string> = {
  1: "1.",
  2: "2.",
  3: "3.",
  4: "4.",
  [-1]: "Sidste",
  firstAndLast: "Første & sidste",
};

function padNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

// eventStartDate kommer enten som en bar "YYYY-MM-DD" (fra det levende
// formular-felt, til forhåndsvisning før gem) eller en fuld ISO-instant
// (fra handleSubmit, efter createDateTime/createAllDayDate). En bar dato
// skal tolkes som lokal midnat, ikke UTC-midnat — ellers kan ugedagen blive
// forkert, samme fejlklasse som blev rettet i Sprint 12.1.
export function parseEventStartDate(eventStartDate: string): Date {
  return eventStartDate.includes("T")
    ? new Date(eventStartDate)
    : new Date(`${eventStartDate}T00:00:00`);
}

function formatDanishDate(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  const weekday = weekdayAbbreviations[date.getDay() as CalendarWeekday];

  return `${weekday} ${padNumber(date.getDate())}-${padNumber(date.getMonth() + 1)}-${date.getFullYear()}`;
}

// Seks måneder frem er kun en rimelig standardværdi for "Indtil"-datoen, når
// brugeren netop har slået gentagelse til — ikke en model-begrænsning.
export function getDefaultRecurrenceUntil(eventStartDate: string): string {
  const date = parseEventStartDate(eventStartDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + 6);

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

// Rimelige standardværdier for byMonthDay/ordinal/ordinalWeekday, udledt af
// aftalens egen startdato — bruges når en gentagelse slås til, eller når
// brugeren skifter frekvens/mønster i "Tilpas"-dialogen.
export function getRecurrenceDefaultsForStartDate(
  eventStartDate: string,
): Pick<
  RecurrenceFormValue,
  "byWeekdays" | "byMonthDay" | "ordinal" | "ordinalWeekday"
> {
  const startDate = parseEventStartDate(eventStartDate);

  if (Number.isNaN(startDate.getTime())) {
    return {
      byWeekdays: [],
      byMonthDay: 1,
      ordinal: 1,
      ordinalWeekday: 1,
    };
  }

  const weekday = startDate.getDay() as CalendarWeekday;
  const dayOfMonth = startDate.getDate();

  return {
    byWeekdays: [weekday],
    byMonthDay: dayOfMonth,
    ordinal: (Math.min(4, Math.ceil(dayOfMonth / 7)) as WeekdayOrdinal),
    ordinalWeekday: weekday,
  };
}

export function recurrenceRuleToFormValue(
  rule: RecurrenceRule | undefined,
): RecurrenceFormValue {
  if (!rule) {
    return defaultRecurrenceFormValue;
  }

  return {
    frequency: rule.frequency,
    interval: rule.interval,
    byWeekdays: rule.byWeekdays ? [...rule.byWeekdays] : [],
    monthlyPattern: rule.monthlyPattern ?? "dayOfMonth",
    byMonthDay: rule.byMonthDay ?? 1,
    ordinal: rule.byOrdinalWeekday
      ? rule.byOrdinalWeekday.ordinals.length === 2 &&
        rule.byOrdinalWeekday.ordinals.includes(1) &&
        rule.byOrdinalWeekday.ordinals.includes(-1)
        ? "firstAndLast"
        : rule.byOrdinalWeekday.ordinals[0]
      : 1,
    ordinalWeekday: rule.byOrdinalWeekday?.weekday ?? 1,
    endType: rule.endType,
    until: rule.until ? rule.until.slice(0, 10) : "",
    count: rule.count ?? 1,
  };
}

export function recurrenceFormValueToRule(
  value: RecurrenceFormValue,
  eventStartDate: string,
): RecurrenceRule | undefined {
  if (value.frequency === "none") {
    return undefined;
  }

  const startDate = parseEventStartDate(eventStartDate);

  const rule: RecurrenceRule = {
    frequency: value.frequency,
    interval: value.interval,
    endType: value.endType,
  };

  if (value.endType === "until" && value.until) {
    rule.until = new Date(`${value.until}T23:59:59`).toISOString();
  }

  if (value.endType === "count") {
    rule.count = value.count;
  }

  if (value.frequency === "weekly") {
    rule.byWeekdays =
      value.byWeekdays.length > 0
        ? [...value.byWeekdays]
        : !Number.isNaN(startDate.getTime())
          ? [startDate.getDay() as CalendarWeekday]
          : undefined;
  }

  if (value.frequency === "monthly") {
    rule.monthlyPattern = value.monthlyPattern;

    if (value.monthlyPattern === "dayOfWeek") {
      rule.byOrdinalWeekday = {
        ordinals:
          value.ordinal === "firstAndLast" ? [1, -1] : [value.ordinal],
        weekday: value.ordinalWeekday,
      };
    } else {
      rule.byMonthDay = value.byMonthDay;
    }
  }

  if (value.frequency === "yearly" && !Number.isNaN(startDate.getTime())) {
    rule.byMonth = startDate.getMonth() + 1;
  }

  return rule;
}

export function getRecurrenceFormValidationError(
  value: RecurrenceFormValue,
): string | null {
  if (value.frequency === "none") {
    return null;
  }

  if (!Number.isInteger(value.interval) || value.interval < 1) {
    return "Intervallet skal være mindst 1.";
  }

  if (value.frequency === "weekly" && value.byWeekdays.length === 0) {
    return "Vælg mindst én ugedag.";
  }

  if (value.endType === "until" && !value.until) {
    return "Vælg en slutdato for gentagelsen.";
  }

  if (
    value.endType === "count" &&
    (!Number.isInteger(value.count) || value.count < 1)
  ) {
    return "Antal gentagelser skal være mindst 1.";
  }

  return null;
}

function describeMonthlyPattern(value: RecurrenceFormValue): string {
  if (value.monthlyPattern === "dayOfWeek") {
    const weekdayName = weekdayFullNames[value.ordinalWeekday];

    if (value.ordinal === "firstAndLast") {
      return `den første og sidste ${weekdayName}`;
    }

    const ordinalLabel = weekdayOrdinalLabels[value.ordinal].toLowerCase();

    return `den ${ordinalLabel} ${weekdayName}`;
  }

  return `den ${value.byMonthDay}.`;
}

export function describeRecurrenceFormValue(
  value: RecurrenceFormValue,
  eventStartDate: string,
): string {
  if (value.frequency === "none") {
    return "Gentages ikke";
  }

  let frequencyText: string;

  switch (value.frequency) {
    case "daily":
      frequencyText =
        value.interval === 1
          ? "Gentages hver dag"
          : `Gentages hver ${value.interval}. dag`;
      break;

    case "weekly": {
      const parsedStartDate = parseEventStartDate(eventStartDate);
      const startWeekday = Number.isNaN(parsedStartDate.getTime())
        ? undefined
        : (parsedStartDate.getDay() as CalendarWeekday);

      const days =
        value.byWeekdays.length > 0
          ? value.byWeekdays
          : startWeekday !== undefined
            ? [startWeekday]
            : [];

      const sortedDays = [...days].sort(
        (first, second) =>
          weekdayDisplayOrder.indexOf(first) -
          weekdayDisplayOrder.indexOf(second),
      );

      const dayNames = sortedDays.map((day) => weekdayFullNames[day]);

      const dayList =
        dayNames.length > 1
          ? `${dayNames.slice(0, -1).join(", ")} og ${dayNames[dayNames.length - 1]}`
          : (dayNames[0] ?? "");

      frequencyText =
        value.interval === 1
          ? `Gentages hver uge om ${dayList}`
          : `Gentages hver ${value.interval}. uge om ${dayList}`;
      break;
    }

    case "monthly":
      frequencyText =
        value.interval === 1
          ? `Gentages hver måned ${describeMonthlyPattern(value)}`
          : `Gentages hver ${value.interval}. måned ${describeMonthlyPattern(value)}`;
      break;

    case "yearly":
      frequencyText =
        value.interval === 1
          ? "Gentages hvert år"
          : `Gentages hvert ${value.interval}. år`;
      break;
  }

  const endText =
    value.endType === "until" && value.until
      ? ` · Indtil ${formatDanishDate(value.until)}`
      : value.endType === "count"
        ? ` · ${value.count} gange`
        : "";

  return frequencyText + endText;
}

// Bestemmer hvilket "hurtigvalg" (Apple-stil dropdown) den aktuelle værdi
// svarer til — "custom" hvis den afviger fra alle de simple standardmønstre
// (fx interval > 1, flere ugedage, "ugedag i måneden"-mønster, eller en
// sluttilstand forskellig fra "aldrig").
export function getRecurrencePresetOption(
  value: RecurrenceFormValue,
  eventStartDate: string,
): RecurrencePresetOption {
  if (value.frequency === "none") {
    return "none";
  }

  if (value.interval !== 1 || value.endType !== "never") {
    return "custom";
  }

  const startDate = parseEventStartDate(eventStartDate);

  switch (value.frequency) {
    case "daily":
      return "daily";

    case "weekly": {
      const startWeekday = Number.isNaN(startDate.getTime())
        ? undefined
        : (startDate.getDay() as CalendarWeekday);

      return value.byWeekdays.length === 1 &&
        value.byWeekdays[0] === startWeekday
        ? "weekly"
        : "custom";
    }

    case "monthly":
      return value.monthlyPattern === "dayOfMonth" &&
        !Number.isNaN(startDate.getTime()) &&
        value.byMonthDay === startDate.getDate()
        ? "monthly"
        : "custom";

    case "yearly":
      return "yearly";

    default:
      return "custom";
  }
}
