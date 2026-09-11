// Tynd klient for /api/families/:id/meal-plan-ruterne (Sprint 38). Samme
// mønster som shoppingListApi.ts's request()-wrapper.

export interface MealPlanEntryDto {
  id: string;
  date: string;
  dishName: string;
  createdByUserId: string;
  createdAt: string;
}

export interface MealPlanIngredientDraftItem {
  name: string;
  category: string;
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

export function getMealPlanEntries(familyId: string, startDate: string, endDate: string) {
  return request<{ entries?: MealPlanEntryDto[]; error?: string }>(
    `/api/families/${familyId}/meal-plan?startDate=${startDate}&endDate=${endDate}`,
  );
}

// Tomt dishName sletter dagens ret i stedet for at gemme en tom streng.
export function setMealPlanEntry(familyId: string, date: string, dishName: string) {
  return request<{ entries?: MealPlanEntryDto[]; error?: string }>(
    `/api/families/${familyId}/meal-plan/${date}`,
    { method: "PUT", body: JSON.stringify({ dishName }) },
  );
}

export function generateMealPlanIngredientsDraft(
  familyId: string,
  listId: string,
  startDate: string,
  endDate: string,
) {
  return request<{ items?: MealPlanIngredientDraftItem[]; error?: string }>(
    `/api/families/${familyId}/meal-plan/generate-ingredients-draft?listId=${listId}&startDate=${startDate}&endDate=${endDate}`,
    { method: "POST" },
  );
}
