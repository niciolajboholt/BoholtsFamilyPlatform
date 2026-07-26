export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const weekday = result.getDay();

  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  result.setDate(result.getDate() - daysSinceMonday);
  result.setHours(12, 0, 0, 0);

  return result;
}

export function getWeekDays(date: Date): Date[] {
  const startOfWeek = getStartOfWeek(date);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfWeek);

    day.setDate(startOfWeek.getDate() + index);
    day.setHours(12, 0, 0, 0);

    return day;
  });
}