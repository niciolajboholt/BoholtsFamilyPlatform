import { getStartOfWeek } from "./getWeekDays";

export interface WindowRange {
  start: Date;
  end: Date;
}

export type WindowAction =
  | { type: "extend-backward" }
  | { type: "extend-forward" }
  | { type: "reanchor"; centerDate: Date };

export const INITIAL_WEEKS_BACK = 6;
export const INITIAL_WEEKS_FORWARD = 6;
export const EXTEND_CHUNK_WEEKS = 4;
export const MAX_TOTAL_WEEKS = 120;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    12,
    0,
    0,
    0,
  );
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function weeksBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_WEEK);
}

/**
 * Bygger familie-planlæggerens indledende rulle-vindue, centreret om
 * `centerDate`s uge: INITIAL_WEEKS_BACK uger bagud, centerDate's egen uge,
 * og INITIAL_WEEKS_FORWARD uger frem.
 */
export function buildInitialWindow(centerDate: Date): WindowRange {
  const targetWeekStart = getStartOfWeek(centerDate);

  return {
    start: addWeeks(targetWeekStart, -INITIAL_WEEKS_BACK),
    end: addWeeks(targetWeekStart, INITIAL_WEEKS_FORWARD + 1),
  };
}

/**
 * Styrer familie-planlæggerens rullende dags-vindue: udvider bagud/fremad i
 * faste bidder (fx udløst af IntersectionObserver-sentinels nær kanten af
 * det synlige område), eller genforankrer vinduet omkring en ny centrum-dato
 * (fx ekstern navigation via Frem/Tilbage/"I dag" i værktøjslinjen) — men
 * kun hvis centrum-datoen reelt falder uden for det allerede indlæste
 * interval, ellers er en re-scroll til den (allerede indlæste) dato nok.
 */
export function windowReducer(
  state: WindowRange,
  action: WindowAction,
): WindowRange {
  switch (action.type) {
    case "extend-backward": {
      if (weeksBetween(state.start, state.end) >= MAX_TOTAL_WEEKS) {
        return state;
      }

      return {
        start: addWeeks(state.start, -EXTEND_CHUNK_WEEKS),
        end: state.end,
      };
    }

    case "extend-forward": {
      if (weeksBetween(state.start, state.end) >= MAX_TOTAL_WEEKS) {
        return state;
      }

      return {
        start: state.start,
        end: addWeeks(state.end, EXTEND_CHUNK_WEEKS),
      };
    }

    case "reanchor": {
      const targetWeekStart = getStartOfWeek(action.centerDate);

      if (
        targetWeekStart.getTime() >= state.start.getTime() &&
        targetWeekStart.getTime() < state.end.getTime()
      ) {
        return state;
      }

      return buildInitialWindow(action.centerDate);
    }

    default:
      return state;
  }
}
