// Sprint 21, Del B: familiens delte indkøbsliste(r). Mønster og
// autorisation følger families.ts's calendar-mappings-ruter — enhver
// familiemedlem må læse/skrive (indkøb er en fælles, uformel aktivitet, i
// modsætning til kalender-tildeling og medlemsadministration, som kræver
// ejer/admin).

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { generateIngredientsDraft } from "../lib/aiAssistant";
import { getMembershipForFamily } from "../lib/familyMembership";
import { sendPushNotificationToFamily } from "../lib/pushNotifications";
import {
  guessShoppingCategory,
  isShoppingCategory,
  isShoppingListType,
  normalizeItemName,
  type ShoppingListType,
} from "../lib/shoppingCategories";
import { checkRateLimit } from "../lib/rateLimit";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };
type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const shoppingLists = new Hono<{ Bindings: Env; Variables: Variables }>();

// Sprint 29: samme begrundelse som tasks.ts's aiDraftRateLimit.
const aiDraftRateLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000 };

async function parseJsonBody<T extends object>(c: Context): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

shoppingLists.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Indkøbsliste-API fejlede:", message);
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

shoppingLists.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

interface ShoppingListRow {
  id: string;
  familyId: string;
  name: string;
  type: ShoppingListType;
  createdAt: string;
}

interface ShoppingListItemRow {
  id: string;
  listId: string;
  name: string;
  category: string;
  isChecked: number;
  addedByUserId: string;
  createdAt: string;
  checkedAt: string | null;
}

// Bekræfter både at brugeren er medlem af familien i URL'en, OG at den
// angivne liste rent faktisk tilhører netop den familie — uden det sidste
// tjek kunne en bruger i praksis tilgå en anden families liste ved blot at
// gætte et listId (samme klasse fejl som Fase 4's cross-family
// kalender-tildelingsbug tidligere i Sprint 20).
async function requireListInFamily(
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

async function listItemsForList(
  db: D1Database,
  listId: string,
): Promise<ShoppingListItemRow[]> {
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
async function resolveCategory(
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

async function saveOverride(
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

// GET/POST /:id/shopping-lists — familiens lister. Den første oprettes
// automatisk ved første opslag, så klienten ikke selv skal håndtere
// "opret en liste, hvis der ingen findes" som et separat trin — UI'et viser
// i første omgang kun denne ene, men API'et understøtter allerede flere.
shoppingLists.get("/:id/shopping-lists", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT id, family_id AS familyId, name, type, created_at AS createdAt FROM shopping_lists WHERE family_id = ? ORDER BY created_at ASC",
  )
    .bind(familyId)
    .all<ShoppingListRow>();

  if (results.length > 0) {
    return c.json({ lists: results });
  }

  const now = new Date().toISOString();
  const defaultList: ShoppingListRow = {
    id: crypto.randomUUID(),
    familyId,
    name: "Indkøbsliste",
    type: "dagligvarer",
    createdAt: now,
  };

  await c.env.DB.prepare(
    "INSERT INTO shopping_lists (id, family_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(defaultList.id, familyId, defaultList.name, defaultList.type, now)
    .run();

  return c.json({ lists: [defaultList] });
});

shoppingLists.post("/:id/shopping-lists", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string; type: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Listen skal have et navn." }, 400);
  }

  if (!body.type || !isShoppingListType(body.type)) {
    return c.json({ error: "Listen skal have en gyldig type." }, 400);
  }

  const type = body.type;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO shopping_lists (id, family_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, familyId, name, type, now)
    .run();

  return c.json({ list: { id, familyId, name, type, createdAt: now } });
});

shoppingLists.patch("/:id/shopping-lists/:listId", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Listen skal have et navn." }, 400);
  }

  await c.env.DB.prepare("UPDATE shopping_lists SET name = ? WHERE id = ?")
    .bind(name, list.id)
    .run();

  return c.json({ list: { ...list, name } });
});

shoppingLists.get("/:id/shopping-lists/:listId/items", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const items = await listItemsForList(c.env.DB, list.id);

  return c.json({ items });
});

// Genererer et ingrediens-UDKAST fra en ret — gemmer intet. Kategorien
// gættes af den eksisterende ordbog/selvlæring (resolveCategory), ikke af
// AI'en selv, så kategoriseringen forbliver konsistent med resten af
// listen (se 23_Sprint23-planen, beslutning 4).
shoppingLists.post("/:id/shopping-lists/:listId/generate-ingredients-draft", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "ai-ingredients-draft",
    key: c.get("user").id,
    ...aiDraftRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  const body = await parseJsonBody<{ dish: string }>(c);
  const dish = body.dish?.trim();

  if (!dish) {
    return c.json({ error: "Skriv navnet på en ret først." }, 400);
  }

  const draftItems = await generateIngredientsDraft(c.env, dish);

  if (!draftItems) {
    return c.json({ error: "Kunne ikke generere et forslag. Prøv at omformulere." }, 502);
  }

  const items = await Promise.all(
    draftItems.map(async (item) => ({
      name: item.name,
      category: await resolveCategory(c.env.DB, familyId, list.type, item.name),
    })),
  );

  return c.json({ items });
});

shoppingLists.post("/:id/shopping-lists/:listId/items", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string; category?: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Varen skal have et navn." }, 400);
  }

  if (body.category !== undefined && !isShoppingCategory(body.category, list.type)) {
    return c.json({ error: "Ukendt kategori." }, 400);
  }

  const category = body.category ?? (await resolveCategory(c.env.DB, familyId, list.type, name));

  if (body.category) {
    // Et eksplicit valgt kategori er en bevidst rettelse fra brugeren —
    // huskes med det samme, ligesom PATCH-kaldet nedenfor gør.
    await saveOverride(c.env.DB, familyId, list.type, name, body.category);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const userId = c.get("user").id;

  await c.env.DB.prepare(
    `INSERT INTO shopping_list_items (id, list_id, name, category, is_checked, added_by_user_id, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, list.id, name, category, userId, now)
    .run();

  c.executionCtx.waitUntil(
    sendPushNotificationToFamily(c.env, familyId, userId, {
      title: "Ny vare på indkøbslisten",
      body: `"${name}" er tilføjet.`,
      url: "/shopping-list",
    }).catch((error: unknown) => {
      console.error("Kunne ikke sende indkøbsliste-push-notifikation:", error);
    }),
  );

  const items = await listItemsForList(c.env.DB, list.id);

  return c.json({ items });
});

shoppingLists.patch("/:id/shopping-lists/:listId/items/:itemId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const itemId = c.req.param("itemId");
  const item = await c.env.DB.prepare(
    "SELECT id, name FROM shopping_list_items WHERE id = ? AND list_id = ?",
  )
    .bind(itemId, list.id)
    .first<{ id: string; name: string }>();

  if (!item) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ isChecked?: boolean; category?: string; name?: string }>(c);

  if (body.category !== undefined) {
    if (!isShoppingCategory(body.category, list.type)) {
      return c.json({ error: "Ukendt kategori." }, 400);
    }

    await saveOverride(c.env.DB, familyId, list.type, item.name, body.category);

    await c.env.DB.prepare("UPDATE shopping_list_items SET category = ? WHERE id = ?")
      .bind(body.category, itemId)
      .run();
  }

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();

    if (!trimmedName) {
      return c.json({ error: "Varen skal have et navn." }, 400);
    }

    // Kun selve navnet rettes — kategorien ændres bevidst ikke automatisk,
    // så en tastefejlsrettelse ikke utilsigtet ændrer en allerede korrekt
    // kategori. Vil brugeren også ændre kategori, sker det som et separat
    // kald (samme mønster som category ovenfor).
    await c.env.DB.prepare("UPDATE shopping_list_items SET name = ? WHERE id = ?")
      .bind(trimmedName, itemId)
      .run();
  }

  if (body.isChecked !== undefined) {
    await c.env.DB.prepare(
      "UPDATE shopping_list_items SET is_checked = ?, checked_at = ? WHERE id = ?",
    )
      .bind(body.isChecked ? 1 : 0, body.isChecked ? new Date().toISOString() : null, itemId)
      .run();
  }

  const items = await listItemsForList(c.env.DB, list.id);

  return c.json({ items });
});

shoppingLists.delete("/:id/shopping-lists/:listId/items/:itemId", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE id = ? AND list_id = ?")
    .bind(c.req.param("itemId"), list.id)
    .run();

  const items = await listItemsForList(c.env.DB, list.id);

  return c.json({ items });
});

// Fjerner alle afkrydsede varer på én gang ("Ryd afkrydsede").
shoppingLists.post("/:id/shopping-lists/:listId/clear-checked", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE list_id = ? AND is_checked = 1")
    .bind(list.id)
    .run();

  const items = await listItemsForList(c.env.DB, list.id);

  return c.json({ items });
});

export default shoppingLists;
