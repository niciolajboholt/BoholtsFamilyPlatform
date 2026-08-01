// Standard ISO 8601-ugenummer-algoritme: find torsdagen i ugen (den dag
// bestemmer, hvilket år/ugenummer ugen tilhører ved års-skift), og sammenlign
// med torsdagen i den uge, der indeholder 4. januar (som pr. definition altid
// ligger i uge 1).
export function getIsoWeekNumber(date: Date): number {
  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const mondayFirstDayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - mondayFirstDayNumber + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  return (
    1 +
    Math.round((target.getTime() - firstThursday.getTime()) / msPerWeek)
  );
}
