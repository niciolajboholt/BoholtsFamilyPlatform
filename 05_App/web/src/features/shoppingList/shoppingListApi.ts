// Tynd klient for /api/families/:id/shopping-lists-ruterne (Sprint 21, Del
// B). Bruger den delte request()-wrapper fra src/lib/apiClient.ts.

import { request } from "../../lib/apiClient";

// Kategorier valideres server-side pr. listetype (se
// server/lib/shoppingCategories.ts) — klienten har derfor ikke ét fast,
// globalt kategorisæt, kun én liste pr. type til at vise valgmuligheder i
// UI'et.
export type ShoppingCategory = string;

// Fast sæt, matcher server/lib/shoppingCategories.ts's ShoppingListType —
// listetyper er bevidst ikke brugerdefinerbare (se
// 22_Sprint22_Flere_Indkoebslister_Plan.md).
export const shoppingListTypes = ["dagligvarer", "byggemarked", "andet"] as const;

export type ShoppingListType = (typeof shoppingListTypes)[number];

export const shoppingListTypeLabels: Record<ShoppingListType, string> = {
  dagligvarer: "Dagligvarer",
  byggemarked: "Byggemarked",
  andet: "Andet",
};

// Skal holdes i sync med server/lib/shoppingCategories.ts's kategorisæt pr.
// type — bruges kun til at vise gyldige valgmuligheder ved manuel
// kategori-rettelse, den faktiske validering sker altid server-side.
export const shoppingCategoriesByListType: Record<ShoppingListType, readonly string[]> = {
  dagligvarer: ["Frugt & grønt", "Mejeri", "Kød", "Bageri", "Frost", "Andet"],
  byggemarked: [
    "Værktøj",
    "Tømmer & plader",
    "Skruer, søm & beslag",
    "Maling & overflade",
    "El & belysning",
    "VVS",
    "Have & udendørs",
    "Andet",
  ],
  andet: ["Ukategoriseret"],
};

export interface ShoppingListDto {
  id: string;
  familyId: string;
  name: string;
  type: ShoppingListType;
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

export function getShoppingLists(familyId: string) {
  return request<{ lists?: ShoppingListDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists`,
  );
}

export function createShoppingList(familyId: string, name: string, type: ShoppingListType) {
  return request<{ list?: ShoppingListDto; error?: string }>(
    `/api/families/${familyId}/shopping-lists`,
    { method: "POST", body: JSON.stringify({ name, type }) },
  );
}

export function updateShoppingList(
  familyId: string,
  listId: string,
  updates: { name?: string; type?: ShoppingListType },
) {
  return request<{ list?: ShoppingListDto; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}`,
    { method: "PATCH", body: JSON.stringify(updates) },
  );
}

export function deleteShoppingList(familyId: string, listId: string) {
  return request<{ lists?: ShoppingListDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}`,
    { method: "DELETE" },
  );
}

export function getShoppingListItems(familyId: string, listId: string) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items`,
  );
}

export interface IngredientDraftItem {
  name: string;
  category: string;
}

export function generateIngredientsDraft(familyId: string, listId: string, dish: string) {
  return request<{ items?: IngredientDraftItem[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/generate-ingredients-draft`,
    { method: "POST", body: JSON.stringify({ dish }) },
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

export function renameShoppingListItem(
  familyId: string,
  listId: string,
  itemId: string,
  name: string,
) {
  return request<{ items?: ShoppingListItemDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/items/${itemId}`,
    { method: "PATCH", body: JSON.stringify({ name }) },
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

export interface ShoppingListTemplateItemDto {
  id: string;
  name: string;
}

export interface ShoppingListTemplateDto {
  id: string;
  listType: ShoppingListType;
  name: string;
  createdAt: string;
  items: ShoppingListTemplateItemDto[];
}

export function getShoppingListTemplates(familyId: string, listId: string) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates`,
  );
}

export function saveShoppingListAsTemplate(familyId: string, listId: string, name: string) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function deleteShoppingListTemplate(familyId: string, listId: string, templateId: string) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates/${templateId}`,
    { method: "DELETE" },
  );
}

export function renameShoppingListTemplate(
  familyId: string,
  listId: string,
  templateId: string,
  name: string,
) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates/${templateId}`,
    { method: "PATCH", body: JSON.stringify({ name }) },
  );
}

export function addShoppingListTemplateItem(
  familyId: string,
  listId: string,
  templateId: string,
  name: string,
) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates/${templateId}/items`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
}

export function deleteShoppingListTemplateItem(
  familyId: string,
  listId: string,
  templateId: string,
  itemId: string,
) {
  return request<{ templates?: ShoppingListTemplateDto[]; error?: string }>(
    `/api/families/${familyId}/shopping-lists/${listId}/templates/${templateId}/items/${itemId}`,
    { method: "DELETE" },
  );
}
