// Sprint 53: tynd klient for barnets/enhedens side af børneadgang
// (/api/child/*) — se server/routes/childAccess.ts. Bevidst en egen fil
// fremfor familyApi.ts/tasksApi.ts: denne bruger IKKE users/sessions-
// cookien, men sin egen child_session-cookie, og kender intet til familyId
// fra klientens side (kun det, serveren selv udleder af cookien).

import type { TaskDto } from "../tasks/tasksApi";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const data = (await response.json().catch(() => ({}))) as T;

  return { ok: response.ok, status: response.status, data };
}

export interface ChildAccessMemberDto {
  name: string;
  color: string;
}

// Offentlig — intet login endnu, viser blot navn/farve så enheden kan hilse
// på barnet, før PIN-koden tastes.
export function getChildAccessLinkInfo(token: string) {
  return request<ChildAccessMemberDto & { error?: string }>(
    `/api/child/access/${encodeURIComponent(token)}`,
  );
}

export function verifyChildAccessPin(token: string, pin: string) {
  return request<{ ok?: boolean; name?: string; color?: string; error?: string }>(
    `/api/child/access/${encodeURIComponent(token)}/verify`,
    { method: "POST", body: JSON.stringify({ pin }) },
  );
}

export interface ChildSessionMemberDto {
  id: string;
  familyId: string;
  name: string;
  color: string;
}

// Bruges til at afgøre, om enheden allerede har en gyldig child_session (så
// PIN-siden kan springes over ved et senere besøg).
export function getChildSessionMe() {
  return request<{ member?: ChildSessionMemberDto; error?: string }>("/api/child/me");
}

export function childLogout() {
  return request<{ ok?: boolean; error?: string }>("/api/child/logout", { method: "POST" });
}

export function getChildTasksForDate(date: string) {
  return request<{ tasks?: TaskDto[]; error?: string }>(
    `/api/child/today?date=${encodeURIComponent(date)}`,
  );
}

export function setChildTaskDone(taskId: string, isDone: boolean) {
  return request<{ tasks?: TaskDto[]; error?: string }>(`/api/child/tasks/${taskId}/done`, {
    method: "POST",
    body: JSON.stringify({ isDone }),
  });
}
