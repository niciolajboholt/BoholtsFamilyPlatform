// Tynd klient for /api/feedback-ruterne (Sprint 30). Samme mønster som
// familyApi.ts: denne fil kender kun til serverens rå JSON-form. Bruger den
// delte request()-wrapper fra src/lib/apiClient.ts.

import { request } from "../../lib/apiClient";

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
