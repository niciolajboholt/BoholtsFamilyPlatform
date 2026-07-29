import type {
  CalendarWeekday,
  RecurrenceEndType,
  RecurrenceFrequency,
  RecurrenceRule,
} from "../models/calendarEvent";

export interface RecurrenceFormValue {
  frequency: RecurrenceFrequency | "none";
  interval: number;
  endType: RecurrenceEndType;
  until: string;
  count: number;
}

export const defaultRecurrenceFormValue: RecurrenceFormValue = {
  frequency: "none",
  interval: 1,
  endType: "never",
  until: "",
  count: 1,
};

export function recurrenceRuleToFormValue(
  rule: RecurrenceRule | undefined,
): RecurrenceFormValue {
  if (!rule) {
    return defaultRecurrenceFormValue;
  }

  return {
    frequency: rule.frequency,
    interval: rule.interval,
    endType: rule.endType,
    until: rule.until ? rule.until.slice(0, 10) : "",
    count: rule.count ?? 1,
  };
}

// byWeekdays/byMonthDay/byMonth udledes bevidst af aftalens startdato i
// stedet for at være egne UI-felter (holder gentagelses-UI'et simpelt i
// Sprint 16) — modellen understøtter fortsat flere ugedage, hvis det
// ønskes senere.
export function recurrenceFormValueToRule(
  value: RecurrenceFormValue,
  eventStartDate: string,
): RecurrenceRule | undefined {
  if (value.frequency === "none") {
    return undefined;
  }

  const startDate = new Date(eventStartDate);

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

  if (value.frequency === "weekly" && !Number.isNaN(startDate.getTime())) {
    rule.byWeekdays = [startDate.getDay() as CalendarWeekday];
  }

  if (value.frequency === "monthly" && !Number.isNaN(startDate.getTime())) {
    rule.byMonthDay = startDate.getDate();
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
