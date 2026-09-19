import {
  familyPseudoMemberId,
  type CalendarEvent,
  type CalendarOwnerId,
} from "../calendar/models/calendarEvent";
import { redactCalendarEventForViewer } from "../calendar/utils/redactCalendarEventForViewer";
import type { TaskDto } from "../tasks/tasksApi";

export interface MitIDagPlan {
  nextEvent: CalendarEvent | null;
  nextTask: TaskDto | null;
  restOfDayEvents: CalendarEvent[];
  restOfDayTasks: TaskDto[];
}

/**
 * "Mit i dag" er et medlems overblik, ikke en kalenderkolonne. Derfor skal
 * både medlemmets egne, flerpersoners og familiens fælles aftaler med. Den
 * eksisterende privatlivsregel afhænger fortsat af den faktiske seer — at
 * vælge et andet medlem i forhåndsvisningen giver ikke adgang til private
 * aftaledetaljer.
 */
export function getMitIDagEvents(
  events: readonly CalendarEvent[],
  selectedMemberId: CalendarOwnerId,
  viewerMemberId: CalendarOwnerId | undefined,
): CalendarEvent[] {
  return events
    .filter(
      (event) =>
        event.ownerIds.includes(selectedMemberId) ||
        event.ownerIds.includes(familyPseudoMemberId),
    )
    .map((event) => redactCalendarEventForViewer(event, viewerMemberId));
}

/** Familieopgaver gælder for alle medlemmer, ligesom på Opgaver-siden. */
export function getMitIDagTasks(
  tasks: readonly TaskDto[],
  selectedMemberId: string,
): TaskDto[] {
  return tasks.filter(
    (task) =>
      task.assignedMemberId === null ||
      task.assignedMemberId === selectedMemberId,
  );
}

export function buildMitIDagPlan(
  events: readonly CalendarEvent[],
  tasks: readonly TaskDto[],
  now: Date,
): MitIDagPlan {
  const upcomingEvents = events.filter(
    (event) => new Date(event.end).getTime() > now.getTime(),
  );
  const undoneTasks = tasks.filter((task) => !task.isDone);

  const nextEvent = upcomingEvents[0] ?? null;
  const nextTask = !nextEvent ? (undoneTasks[0] ?? null) : null;

  return {
    nextEvent,
    nextTask,
    restOfDayEvents: nextEvent ? upcomingEvents.slice(1) : upcomingEvents,
    restOfDayTasks: nextTask
      ? tasks.filter((task) => task.id !== nextTask.id)
      : [...tasks],
  };
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
