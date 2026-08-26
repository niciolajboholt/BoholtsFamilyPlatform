// Tynd klient for /api/families/:id/tasks og /task-routines-ruterne
// (Sprint 23). Bruger den delte request()-wrapper fra src/lib/apiClient.ts.

import { request } from "../../lib/apiClient";

export interface TaskDto {
  id: string;
  familyId: string;
  name: string;
  icon: string;
  assignedMemberId: string | null;
  timeOfDay: string | null;
  isDone: number;
  routineItemId: string | null;
  taskDate: string | null;
  createdByUserId: string;
  createdAt: string;
  doneAt: string | null;
}

export interface TaskRoutineItemDto {
  id: string;
  routineId: string;
  name: string;
  icon: string;
  timeOfDay: string | null;
  sortOrder: number;
}

export interface TaskRoutineDto {
  id: string;
  familyId: string;
  name: string;
  assignedMemberId: string | null;
  weekdays: number[];
  createdAt: string;
  items?: TaskRoutineItemDto[];
}

export interface NewRoutineItemInput {
  name: string;
  icon: string;
  timeOfDay?: string | null;
}


export function getTasks(familyId: string, date: string) {
  return request<{ tasks?: TaskDto[]; error?: string }>(
    `/api/families/${familyId}/tasks?date=${encodeURIComponent(date)}`,
  );
}

export function addTask(
  familyId: string,
  task: {
    name: string;
    icon: string;
    date: string;
    assignedMemberId?: string | null;
    timeOfDay?: string | null;
  },
) {
  return request<{ tasks?: TaskDto[]; error?: string }>(`/api/families/${familyId}/tasks`, {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export function updateTask(
  familyId: string,
  taskId: string,
  patch: { isDone?: boolean; name?: string; icon?: string; timeOfDay?: string | null },
) {
  return request<{ tasks?: TaskDto[]; error?: string }>(
    `/api/families/${familyId}/tasks/${taskId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export function deleteTask(familyId: string, taskId: string) {
  return request<{ tasks?: TaskDto[]; error?: string }>(
    `/api/families/${familyId}/tasks/${taskId}`,
    { method: "DELETE" },
  );
}

export function clearDoneTasks(familyId: string, date: string) {
  return request<{ tasks?: TaskDto[]; error?: string }>(
    `/api/families/${familyId}/tasks/clear-done?date=${encodeURIComponent(date)}`,
    { method: "POST" },
  );
}

export function getTaskRoutines(familyId: string) {
  return request<{ routines?: TaskRoutineDto[]; error?: string }>(
    `/api/families/${familyId}/task-routines`,
  );
}

export function createTaskRoutine(
  familyId: string,
  routine: {
    name: string;
    weekdays: number[];
    assignedMemberId?: string | null;
    items: NewRoutineItemInput[];
  },
) {
  return request<{ routine?: TaskRoutineDto; error?: string }>(
    `/api/families/${familyId}/task-routines`,
    { method: "POST", body: JSON.stringify(routine) },
  );
}

export function deleteTaskRoutine(familyId: string, routineId: string) {
  return request<{ ok?: boolean; error?: string }>(
    `/api/families/${familyId}/task-routines/${routineId}`,
    { method: "DELETE" },
  );
}

export interface RoutineDraftItem {
  name: string;
  icon: string;
  timeOfDay: string | null;
}

export interface RoutineDraft {
  name: string;
  items: RoutineDraftItem[];
}

export function generateRoutineDraft(familyId: string, description: string) {
  return request<{ draft?: RoutineDraft; error?: string }>(
    `/api/families/${familyId}/task-routines/generate-draft`,
    { method: "POST", body: JSON.stringify({ description }) },
  );
}
