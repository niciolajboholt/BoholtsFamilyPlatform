import type { Context } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import {
  guessShoppingCategory,
  normalizeItemName,
  type ShoppingListType,
} from "../../lib/shoppingCategories";
import type { SessionUser } from "../../lib/session";

export type Variables = { user: SessionUser };
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

export interface ShoppingListRow {
  id: string;
  familyId: string;
  name: string;
  type: ShoppingListType;
  createdAt: string;
}

export interface ShoppingListItemRow {
  id: string;
  listId: string;
  name: string;
  category: string;
  isChecked: number;
  addedByUserId: string;
  createdAt: string;
  checkedAt: string | null;
}

export interface ShoppingListTemplateRow {
  id: string;
  familyId: string;
  listType: ShoppingListType;
  name: string;
  createdAt: string;
}

// Bekræfter både at brugeren er medlem af familien i URL'en, OG at den
// angivne liste rent faktisk tilhører netop den familie — uden det sidste
// tjek kunne en bruger i praksis tilgå en anden families liste ved blot at
// gætte et listId (samme klasse fejl som Fase 4's cross-family
// kalender-tildelingsbug tidligere i Sprint 20).
export async function requireListInFamily(
  c: AppContext,
  familyId: string,
  listId: string,
): Promise<ShoppingListRow | null> {
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return null;
  }

  const list = await c.env.DB.prepare(
    "SELECT id, family_id AS familyId, name, type, created_at AS createdAt FROM shopping_lists WHERE id = ? AND family_id = ?",
  )
    .bind(listId, familyId)
    .first<ShoppingListRow>();

  return list ?? null;
}

export async function listItemsForList(db: D1Database, listId: string): Promise<ShoppingListItemRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, list_id AS listId, name, category, is_checked AS isChecked,
              added_by_user_id AS addedByUserId, created_at AS createdAt, checked_at AS checkedAt
       FROM shopping_list_items
       WHERE list_id = ?
       ORDER BY category ASC, is_checked ASC, created_at ASC`,
    )
    .bind(listId)
    .all<ShoppingListItemRow>();

  return results;
}

// Familiens egne, tidligere rettelser har altid forrang over den indbyggede
// ordbog — det er selve "selvlæringen" (se 21_Sprint21-planen). Overrides
// er skalaret pr. listetype (Sprint 22): samme varenavn kan gætte
// forskelligt afhængig af om det er en dagligvarer- eller
// byggemarked-liste.
export async function resolveCategory(
  db: D1Database,
  familyId: string,
  listType: ShoppingListType,
  itemName: string,
): Promise<string> {
  const normalized = normalizeItemName(itemName);

  const override = await db
    .prepare(
      "SELECT category FROM shopping_item_category_overrides WHERE family_id = ? AND list_type = ? AND item_name_normalized = ?",
    )
    .bind(familyId, listType, normalized)
    .first<{ category: string }>();

  if (override) {
    return override.category;
  }

  return guessShoppingCategory(itemName, listType);
}

export async function saveOverride(
  db: D1Database,
  familyId: string,
  listType: ShoppingListType,
  itemName: string,
  category: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO shopping_item_category_overrides (family_id, list_type, item_name_normalized, category)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(family_id, list_type, item_name_normalized) DO UPDATE SET category = excluded.category`,
    )
    .bind(familyId, listType, normalizeItemName(itemName), category)
    .run();
}

export interface ShoppingListTemplateItemRow {
  id: string;
  name: string;
}

export async function listTemplatesForFamily(
  db: D1Database,
  familyId: string,
  listType: ShoppingListType,
): Promise<{ template: ShoppingListTemplateRow; items: ShoppingListTemplateItemRow[] }[]> {
  const { results: templates } = await db
    .prepare(
      `SELECT id, family_id AS familyId, list_type AS listType, name, created_at AS createdAt
       FROM shopping_list_templates
       WHERE family_id = ? AND list_type = ?
       ORDER BY created_at ASC`,
    )
    .bind(familyId, listType)
    .all<ShoppingListTemplateRow>();

  return Promise.all(
    templates.map(async (template) => {
      const { results: items } = await db
        .prepare("SELECT id, name FROM shopping_list_template_items WHERE template_id = ? ORDER BY name ASC")
        .bind(template.id)
        .all<ShoppingListTemplateItemRow>();

      return { template, items };
    }),
  );
}

export function toTemplateDto({
  template,
  items,
}: {
  template: ShoppingListTemplateRow;
  items: ShoppingListTemplateItemRow[];
}) {
  return {
    id: template.id,
    listType: template.listType,
    name: template.name,
    createdAt: template.createdAt,
    items,
  };
}

// Samme familie-scopede eksistens-tjek, som requireListInFamily bruger for
// lister — undgår at et gættet templateId fra en anden familie kan tilgås.
export async function requireTemplateInFamily(
  db: D1Database,
  familyId: string,
  templateId: string,
): Promise<ShoppingListTemplateRow | null> {
  const template = await db
    .prepare(
      `SELECT id, family_id AS familyId, list_type AS listType, name, created_at AS createdAt
       FROM shopping_list_templates WHERE id = ? AND family_id = ?`,
    )
    .bind(templateId, familyId)
    .first<ShoppingListTemplateRow>();

  return template ?? null;
}
