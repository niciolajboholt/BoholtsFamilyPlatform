import type { CalendarEvent } from "../models/calendarEvent";

export interface DayTimelineLayoutEntry {
  event: CalendarEvent;
  columnIndex: number;
  columnCount: number;
  topPercent: number;
  heightPercent: number;
}

const MINUTES_PER_DAY = 24 * 60;

// Sikrer at selv meget korte aftaler forbliver synlige/klikbare på tidslinjen.
const MINIMUM_EVENT_DURATION_MINUTES = 20;

interface TimedInterval {
  event: CalendarEvent;
  startMinutes: number;
  endMinutes: number;
}

function getMinutesSinceDayStart(date: Date, dayStart: Date): number {
  return (date.getTime() - dayStart.getTime()) / 60000;
}

// Klipper en aftale, der strækker sig uden for dagen (fx en flerdags- eller
// midnatsoverskridende aftale), til dagens grænser (0–1440 minutter) — brug
// af tidsstempel-differencer i stedet for getHours()/getMinutes() undgår at
// "midnat næste dag" fejlagtigt regnes som minut 0 i stedet for 1440.
function toTimedInterval(
  event: CalendarEvent,
  dayStart: Date,
): TimedInterval {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  const startMinutes = Math.max(
    0,
    getMinutesSinceDayStart(eventStart, dayStart),
  );

  const rawEndMinutes = Math.min(
    MINUTES_PER_DAY,
    getMinutesSinceDayStart(eventEnd, dayStart),
  );

  return {
    event,
    startMinutes,
    endMinutes: Math.max(
      rawEndMinutes,
      startMinutes + MINIMUM_EVENT_DURATION_MINUTES,
    ),
  };
}

function sortIntervals(
  intervals: TimedInterval[],
): TimedInterval[] {
  return [...intervals].sort((first, second) => {
    if (first.startMinutes !== second.startMinutes) {
      return first.startMinutes - second.startMinutes;
    }

    const firstDuration = first.endMinutes - first.startMinutes;
    const secondDuration = second.endMinutes - second.startMinutes;

    if (firstDuration !== secondDuration) {
      return secondDuration - firstDuration;
    }

    return first.event.title.localeCompare(second.event.title, "da-DK");
  });
}

// Grupperer overlappende intervaller transitivt — hvis A overlapper B og B
// overlapper C, havner alle tre i samme klynge, selvom A og C ikke selv
// overlapper. Klynger deler kolonne-antal, så aftaler i én klynge ikke
// påvirkes af bredden på en helt anden, ikke-overlappende klynge samme dag.
function groupIntoClusters(
  sortedIntervals: TimedInterval[],
): TimedInterval[][] {
  const clusters: TimedInterval[][] = [];
  let currentCluster: TimedInterval[] = [];
  let clusterEndMinutes = -Infinity;

  for (const interval of sortedIntervals) {
    if (
      currentCluster.length > 0 &&
      interval.startMinutes >= clusterEndMinutes
    ) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEndMinutes = -Infinity;
    }

    currentCluster.push(interval);
    clusterEndMinutes = Math.max(clusterEndMinutes, interval.endMinutes);
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters;
}

// Grådig kolonne-tildeling inden for én klynge: hver aftale får den
// tidligst-nummererede kolonne, hvis forrige aftale allerede er slut, ellers
// en ny kolonne.
function assignColumns(
  cluster: TimedInterval[],
): Map<TimedInterval, number> {
  const columnEndMinutes: number[] = [];
  const columnByInterval = new Map<TimedInterval, number>();

  for (const interval of cluster) {
    let assignedColumn = columnEndMinutes.findIndex(
      (endMinutes) => endMinutes <= interval.startMinutes,
    );

    if (assignedColumn === -1) {
      assignedColumn = columnEndMinutes.length;
      columnEndMinutes.push(interval.endMinutes);
    } else {
      columnEndMinutes[assignedColumn] = interval.endMinutes;
    }

    columnByInterval.set(interval, assignedColumn);
  }

  return columnByInterval;
}

/**
 * Beregner positions-layout for én dags tidsbestemte aftaler til
 * dagsvisningens time-tidslinje: lodret placering efter klokkeslæt
 * (topPercent/heightPercent, 0–100 = midnat–midnat) og vandret
 * kolonne-tildeling for overlappende aftaler (columnIndex/columnCount).
 * Heldagsaftaler skal filtreres fra, før denne kaldes.
 */
export function layoutDayTimelineEvents(
  events: readonly CalendarEvent[],
  day: Date,
): DayTimelineLayoutEntry[] {
  const dayStart = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    0,
    0,
    0,
  );

  const intervals = sortIntervals(
    events.map((event) => toTimedInterval(event, dayStart)),
  );

  const clusters = groupIntoClusters(intervals);

  const entries: DayTimelineLayoutEntry[] = [];

  for (const cluster of clusters) {
    const columnByInterval = assignColumns(cluster);
    const columnCount = Math.max(...columnByInterval.values()) + 1;

    for (const interval of cluster) {
      entries.push({
        event: interval.event,
        columnIndex: columnByInterval.get(interval) ?? 0,
        columnCount,
        topPercent: (interval.startMinutes / MINUTES_PER_DAY) * 100,
        heightPercent:
          ((interval.endMinutes - interval.startMinutes) / MINUTES_PER_DAY) *
          100,
      });
    }
  }

  return entries;
}
