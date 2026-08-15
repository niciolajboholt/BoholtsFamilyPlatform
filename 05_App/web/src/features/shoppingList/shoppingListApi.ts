// Tynd klient for /api/families/:id/shopping-lists-ruterne (Sprint 21, Del
// B). Samme mønster som familyApi.ts's request()-wrapper.

export const shoppingCategories = [
  "Frugt & grønt",
  "Mejeri",
  "Kød",
  "Bageri",
  "Frost",
  "Andet",
] as const;

export type ShoppingCategory = (typeof shoppingCategories)[number];

export interface ShoppingListDto {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
}

export interface ShoppingListItemDto {
  id: string;
  listId: string;
  name: string;
  category: string;
  isChecked: number;
  addedByUserId: string;
  createdAt: string;
  checkedAt: string | null;
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

export function getShoppingLists(familyId: string) {
  return request<{ lists?: ShoppingListDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists`,
  );
}

export function getShoppingListItems(familyId: string, listId: string) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items`,
  );
}

export function addShoppingListItem(
  familyId: string,
  listId: string,
  name: string,
  category?: ShoppingCategory,
) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items`,
    { method: "POST", body: JSON.stringify(category ? { name, category } : { name }) },
  );
}

export function setShoppingListItemChecked(
  familyId: string,
  listId: string,
  itemId: string,
  isChecked: boolean,
) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify({ isChecked }) },
  );
}

export function setShoppingListItemCategory(
  familyId: string,
  listId: string,
  itemId: string,
  category: ShoppingCategory,
) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify({ category }) },
  );
}

export function deleteShoppingListItem(familyId: string, listId: string, itemId: string) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items/${itemId}`,
    { method: "DELETE" },
  );
}

export function clearCheckedShoppingListItems(familyId: string, listId: string) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/clear-checked`,
    { method: "POST" },
  );
}
