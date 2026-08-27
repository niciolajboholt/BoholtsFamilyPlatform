import { Hono } from "hono";

import type { Env } from "../../env";
import {
  listItemsForList,
  listTemplatesForFamily,
  parseJsonBody,
  requireListInFamily,
  requireTemplateInFamily,
  toTemplateDto,
  type Variables,
} from "./shoppingListQueries";

const templates = new Hono<{ Bindings: Env; Variables: Variables }>();

// Genbrugelige skabeloner (Sprint 31) — et navngivet snapshot af varenavne
// (ingen kategori gemt, se migrationsfilens kommentar), scopet til listens
// egen type, ligesom kategori-overrides.
templates.get("/:id/shopping-lists/:listId/templates", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

// Gemmer den VALGTE listes nuværende varenavne (afkrydsede såvel som ej) som
// en ny skabelon — ingen separat "byg en skabelon"-formular nødvendig, man
// bygger den blot som en almindelig liste først og gemmer den bagefter.
templates.post("/:id/shopping-lists/:listId/templates", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Skabelonen skal have et navn." }, 400);
  }

  const items = await listItemsForList(c.env.DB, list.id);

  if (items.length === 0) {
    return c.json({ error: "Listen er tom — tilføj varer, før du gemmer den som skabelon." }, 400);
  }

  const templateId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO shopping_list_templates (id, family_id, list_type, name, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(templateId, familyId, list.type, name, now)
    .run();

  // Ét varenavn kan optræde flere gange på selve listen (fx tilføjet to
  // gange ved en fejl) — DISTINCT undgår at skabelonen arver dubletter.
  const uniqueNames = [...new Set(items.map((item) => item.name))];

  await c.env.DB.batch(
    uniqueNames.map((itemName) =>
      c.env.DB.prepare(
        "INSERT INTO shopping_list_template_items (id, template_id, name) VALUES (?, ?, ?)",
      ).bind(crypto.randomUUID(), templateId, itemName),
    ),
  );

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

templates.patch("/:id/shopping-lists/:listId/templates/:templateId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const template = await requireTemplateInFamily(c.env.DB, familyId, c.req.param("templateId"));

  if (!template) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Skabelonen skal have et navn." }, 400);
  }

  await c.env.DB.prepare("UPDATE shopping_list_templates SET name = ? WHERE id = ?")
    .bind(name, template.id)
    .run();

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

templates.delete("/:id/shopping-lists/:listId/templates/:templateId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const template = await requireTemplateInFamily(c.env.DB, familyId, c.req.param("templateId"));

  if (!template) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_template_items WHERE template_id = ?")
    .bind(template.id)
    .run();
  await c.env.DB.prepare("DELETE FROM shopping_list_templates WHERE id = ?").bind(template.id).run();

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

// Tilføjer én vare til en EKSISTERENDE skabelon (i modsat retning af
// oprettelses-flowet, som snapshotter en hel liste på én gang) — bruges af
// skabelon-redigeringen til at bygge videre på en gemt skabelon.
templates.post("/:id/shopping-lists/:listId/templates/:templateId/items", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const template = await requireTemplateInFamily(c.env.DB, familyId, c.req.param("templateId"));

  if (!template) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{ name: string }>(c);
  const name = body.name?.trim();

  if (!name) {
    return c.json({ error: "Varen skal have et navn." }, 400);
  }

  await c.env.DB.prepare("INSERT INTO shopping_list_template_items (id, template_id, name) VALUES (?, ?, ?)")
    .bind(crypto.randomUUID(), template.id, name)
    .run();

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

templates.delete("/:id/shopping-lists/:listId/templates/:templateId/items/:itemId", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.param("listId"));

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const template = await requireTemplateInFamily(c.env.DB, familyId, c.req.param("templateId"));

  if (!template) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM shopping_list_template_items WHERE id = ? AND template_id = ?")
    .bind(c.req.param("itemId"), template.id)
    .run();

  const templateList = await listTemplatesForFamily(c.env.DB, familyId, list.type);

  return c.json({ templates: templateList.map(toTemplateDto) });
});

export default templates;
