// Tynd klient for /api/families/:id/event-reminders/:eventId-ruterne
// (Sprint 31). Samme mønster som shoppingListApi.ts's request()-wrapper.
// eventId er allerede kodet af provider-laget (fx googleCalendarIds.ts) —
// sendes uændret som stien, IKKE encodeURIComponent'et igen (id'et er
// allerede sikkert som ét stisegment, en ekstra kodning ville dobbelt-kode
// de indlejrede kalender-/event-id-dele).

export const eventReminderOffsetOptions = [
  { minutes: 10, label: "10 minutter før" },
  { minutes: 30, label: "30 minutter før" },
  { minutes: 60, label: "1 time før" },
  { minutes: 24 * 60, label: "1 dag før" },
  { minutes: 3 * 24 * 60, label: "3 dage før" },
] as const;

export interface EventReminderDto {
  offsetMinutes: number;
}

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

export function getEventReminder(familyId: string, eventId: string) {
  return request<{ reminder: EventReminderDto | null; error?: string }>(
    `/api/families/${familyId}/event-reminders/${eventId}`,
  );
}

export function setEventReminder(familyId: string, eventId: string, offsetMinutes: number) {
  return request<{ reminder: EventReminderDto | null; error?: string }>(
    `/api/families/${familyId}/event-reminders/${eventId}`,
    { method: "PUT", body: JSON.stringify({ offsetMinutes }) },
  );
}

export function deleteEventReminder(familyId: string, eventId: string) {
  return request<{ reminder: null; error?: string }>(
    `/api/families/${familyId}/event-reminders/${eventId}`,
    { method: "DELETE" },
  );
}
