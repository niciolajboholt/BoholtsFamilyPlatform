import { Hono } from "hono";

import type { Env } from "../../env";
import { generateIngredientsDraft } from "../../lib/aiAssistant";
import { sendPushNotificationToFamily } from "../../lib/pushNotifications";
import { checkRateLimit } from "../../lib/rateLimit";
import { isShoppingCategory } from "../../lib/shoppingCategories";
import { logError } from "../../lib/structuredLog";
import {
  listItemsForList,
  parseJsonBody,
  requireListInFamily,
  resolveCategory,
  saveOverride,
  type Variables,
} from "./shoppingListQueries";

// Sprint 29: samme begrundelse som tasks.ts's aiDraftRateLimit.
const aiDraftRateLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000 };

const items = new Hono<{ Bindings: Env; Variables: Variables }>();

items.get("/:id/shopping-lists/:listId/items", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const itemList = await listItemsForList(c.env.DB, list.id);

  return c.json({ items: itemList });
});

// Genererer et ingrediens-UDKAST fra en ret — gemmer intet. Kategorien
// gættes af den eksisterende ordbog/selvlæring (resolveCategory), ikke af
// AI'en selv, så kategoriseringen forbliver konsistent med resten af
// listen (se 23_Sprint23-planen, beslutning 4).
items.post("/:id/shopping-lists/:listId/generate-ingredients-draft", async (c) => {
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

  const draftWithCategories = await Promise.all(
    draftItems.map(async (item) => ({
      name: item.name,
      category: await resolveCategory(c.env.DB, familyId, list.type, item.name),
    })),
  );

  return c.json({ items: draftWithCategories });
});

items.post("/:id/shopping-lists/:listId/items", async (c) => {
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
      logError("Kunne ikke sende indkøbsliste-push-notifikation", error, { familyId });
    }),
  );

  const itemList = await listItemsForList(c.env.DB, list.id);

  return c.json({ items: itemList });
});

items.patch("/:id/shopping-lists/:listId/items/:itemId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const itemId = c.req.param("itemId");
  const item = await c.env.DB.prepare("SELECT id, name FROM shopping_list_items WHERE id = ? AND list_id = ?")
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
    await c.env.DB.prepare("UPDATE shopping_list_items SET is_checked = ?, checked_at = ? WHERE id = ?")
      .bind(body.isChecked ? 1 : 0, body.isChecked ? new Date().toISOString() : null, itemId)
      .run();
  }

  const itemList = await listItemsForList(c.env.DB, list.id);

  return c.json({ items: itemList });
});

items.delete("/:id/shopping-lists/:listId/items/:itemId", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE id = ? AND list_id = ?")
    .bind(c.req.param("itemId"), list.id)
    .run();

  const itemList = await listItemsForList(c.env.DB, list.id);

  return c.json({ items: itemList });
});

// Fjerner alle afkrydsede varer på én gang ("Ryd afkrydsede").
items.post("/:id/shopping-lists/:listId/clear-checked", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE list_id = ? AND is_checked = 1")
    .bind(list.id)
    .run();

  const itemList = await listItemsForList(c.env.DB, list.id);

  return c.json({ items: itemList });
});

export default items;
