export interface CalendarMonthDay {
  date: Date;
  isCurrentMonth: boolean;
}

function getMondayBasedWeekday(date: Date): number {
  const weekday = date.getDay();

  return weekday === 0 ? 6 : weekday - 1;
}

export function getCalendarMonth(
  visibleMonth: Date,
): CalendarMonthDay[] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  firstDayOfMonth.setHours(12, 0, 0, 0);

  const daysBeforeMonth =
    getMondayBasedWeekday(firstDayOfMonth);

  const firstCalendarDate = new Date(firstDayOfMonth);
  firstCalendarDate.setDate(
    firstCalendarDate.getDate() - daysBeforeMonth,
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCalendarDate);

    date.setDate(firstCalendarDate.getDate() + index);
    date.setHours(12, 0, 0, 0);

    return {
      date,
      isCurrentMonth: date.getMonth() === month,
    };
  });
}