// Sprint 40: fødselsdage gemmes som "MM-DD" (ingen år, se
// 40_Sprint40_Foedselsdag_Gaveplanlaegning_Plan.md) — delt mellem
// familyMembers.ts (validering ved indtastning) og birthdayReminders.ts
// (den daglige cron-tjek).

const monthDayPattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Kun grov format- og måneds-/dagsinterval-validering (regex ovenfor) —
// ikke en fuld kalenderkontrol (fx 02-30 accepteres). En fødselsdag har
// intet år at slå op imod, så en præcis skudårs-/dagsantal-kontrol giver
// ikke mening her, i modsætning til isValidDateString i taskQueries.ts.
export function isValidMonthDay(value: string): boolean {
  return monthDayPattern.test(value);
}

// Antal dage til NÆSTE forekomst af en "MM-DD"-fødselsdag, fra `today`
// (samme dag tæller som 0, ikke 365) — bruges både til reminder-cronen og
// evt. UI-visning ("om N dage").
export function daysUntilNextBirthday(birthdayMonthDay: string, today: Date): number {
  const [month, day] = birthdayMonthDay.split("-").map(Number);
  const year = today.getUTCFullYear();

  const todayUtc = Date.UTC(year, today.getUTCMonth(), today.getUTCDate());
  let nextOccurrence = Date.UTC(year, month! - 1, day);

  if (nextOccurrence < todayUtc) {
    nextOccurrence = Date.UTC(year + 1, month! - 1, day);
  }

  return Math.round((nextOccurrence - todayUtc) / (24 * 60 * 60 * 1000));
}
