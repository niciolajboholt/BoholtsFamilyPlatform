function padNumber(
  value: number,
): string {
  return value
    .toString()
    .padStart(2, "0");
}

function toDate(
  value: Date | string,
): Date {
  return typeof value === "string"
    ? new Date(value)
    : value;
}

export function toDateInputValue(
  value: Date | string,
): string {
  const date = toDate(value);

  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join("-");
}

export function toTimeInputValue(
  value: Date | string,
): string {
  const date = toDate(value);

  return [
    padNumber(date.getHours()),
    padNumber(date.getMinutes()),
  ].join(":");
}

export function createDateTime(
  date: string,
  time: string,
): string {
  return new Date(
    `${date}T${time}:00`,
  ).toISOString();
}

export function createAllDayDate(
  date: string,
  addDay: boolean,
): string {
  const value = new Date(
    `${date}T00:00:00`,
  );

  if (addDay) {
    value.setDate(
      value.getDate() + 1,
    );
  }

  return value.toISOString();
}

export function subtractOneCalendarDay(
  date: Date,
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() - 1,
  );

  return result;
}

export function isSameCalendarDate(
  firstDate: Date,
  secondDate: Date,
): boolean {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

export function ensureEndDateOnOrAfterStartDate(
  startDate: string,
  endDate: string,
): string {
  return !endDate || endDate < startDate
    ? startDate
    : endDate;
}
