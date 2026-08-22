// Tynd klient for /api/feedback-ruterne (Sprint 30). Samme mønster som
// familyApi.ts: denne fil kender kun til serverens rå JSON-form.

export type FeedbackCategory = "idea" | "bug" | "other";

export interface FeedbackEntryDto {
  id: string;
  category: FeedbackCategory;
  message: string;
  page: string | null;
  createdAt: string;
  isRead: number;
  senderName: string;
  senderEmail: string;
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

export function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
  page?: string;
}) {
  return request<{ error?: string }>("/api/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// 403 for enhver, der ikke er ADMIN_EMAIL på serveren — kaldet bruges også
// til stille at afgøre, om admin-indbakken skal vises overhovedet (se
// useFeedbackInbox), ikke kun til selve listen.
export function getFeedback() {
  return request<{ feedback?: FeedbackEntryDto[]; error?: string }>(
    "/api/feedback",
  );
}

export function markFeedbackRead(id: string, isRead: boolean) {
  return request<{ error?: string }>(
    `/api/feedback/${encodeURIComponent(id)}/read`,
    {
      method: "PATCH",
      body: JSON.stringify({ isRead }),
    },
  );
}
