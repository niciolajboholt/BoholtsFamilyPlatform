import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { isShoppingListType } from "../../lib/shoppingCategories";
import {
  parseJsonBody,
  requireListInFamily,
  type ShoppingListRow,
  type Variables,
} from "./shoppingListQueries";

const lists = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET/POST /:id/shopping-lists — familiens lister. Den første oprettes
// automatisk ved første opslag, så klienten ikke selv skal håndtere
// "opret en liste, hvis der ingen findes" som et separat trin — UI'et viser
// i første omgang kun denne ene, men API'et understøtter allerede flere.
lists.get("/:id/shopping-lists", async (c) => {
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

lists.post("/:id/shopping-lists", async (c) => {
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

lists.patch("/:id/shopping-lists/:listId", async (c) => {
  const list = await requireListInFamily(c, c.req.param("id"), c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string; type: string }>(c);

  const name = body.name !== undefined ? body.name.trim() : list.name;
  if (!name) {
    return c.json({ error: "Listen skal have et navn." }, 400);
  }

  const type = body.type !== undefined ? body.type : list.type;
  if (body.type !== undefined && !isShoppingListType(body.type)) {
    return c.json({ error: "Ukendt listetype." }, 400);
  }

  await c.env.DB.prepare("UPDATE shopping_lists SET name = ?, type = ? WHERE id = ?")
    .bind(name, type, list.id)
    .run();

  return c.json({ list: { ...list, name, type } });
});

// Sletter listen og alle dens varer. Familiens sidste liste kan godt
// slettes — GET /:id/shopping-lists opretter automatisk en ny, tom
// standardliste, næste gang familien henter sine lister (samme logik som
// første gang nogen overhovedet åbner indkøbslisten), så der er intet
// særtilfælde at holde styr på her.
lists.delete("/:id/shopping-lists/:listId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE list_id = ?").bind(list.id).run();
  await c.env.DB.prepare("DELETE FROM shopping_lists WHERE id = ?").bind(list.id).run();

  const { results } = await c.env.DB.prepare(
    "SELECT id, family_id AS familyId, name, type, created_at AS createdAt FROM shopping_lists WHERE family_id = ? ORDER BY created_at ASC",
  )
    .bind(familyId)
    .all<ShoppingListRow>();

  return c.json({ lists: results });
});

export default lists;
