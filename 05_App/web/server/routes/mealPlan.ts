// Sprint 38 (se
// 01_Project_Documentation/Development/38_Sprint38_Maaltidsplanlaegning_Plan.md):
// en ugeplan (dato -> ret), der kan generere indkøbsliste-varer automatisk
// via det eksisterende AI-modul. Måltider er familie-fælles, ikke tildelt
// et enkelt medlem — samme antagelse som selve indkøbslisten. Mønster og
// autorisation følger activity.ts/shoppingLists.ts: enhver familiemedlem
// må læse/skrive.

import { Hono } from "hono";

import type { Env } from "../env";
import { generateIngredientsDraft } from "../lib/aiAssistant";
import { getMembershipForFamily } from "../lib/familyMembership";
import { checkRateLimit } from "../lib/rateLimit";
import { logError } from "../lib/structuredLog";
import { getSessionUser, type SessionUser } from "../lib/session";
import { isValidDateString } from "./taskRoutes/taskQueries";
import { requireListInFamily, resolveCategory, type AppContext } from "./shoppingListRoutes/shoppingListQueries";

type Variables = { user: SessionUser };

const mealPlan = new Hono<{ Bindings: Env; Variables: Variables }>();

// Samme begrundelse som shoppingListRoutes/items.tss aiDraftRateLimit —
// generøs nok til reel brug, skåner både D1 og Workers AI mod misbrug.
const aiDraftRateLimit = { maxAttempts: 20, windowMs: 10 * 60 * 1000 };

mealPlan.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Måltidsplan-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

mealPlan.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

interface MealPlanEntryRow {
  id: string;
  date: string;
  dishName: string;
  createdByUserId: string;
  createdAt: string;
}

async function listEntriesInRange(
  db: D1Database,
  familyId: string,
  startDate: string,
  endDate: string,
): Promise<MealPlanEntryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, date, dish_name AS dishName, created_by_user_id AS createdByUserId, created_at AS createdAt
       FROM meal_plan_entries
       WHERE family_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
    )
    .bind(familyId, startDate, endDate)
    .all<MealPlanEntryRow>();

  return results;
}

async function parseJsonBody<T extends object>(c: AppContext): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

// GET /:id/meal-plan?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
mealPlan.get("/:id/meal-plan", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
    return c.json({ error: "Ugyldigt datointerval." }, 400);
  }

  const entries = await listEntriesInRange(c.env.DB, familyId, startDate, endDate);

  return c.json({ entries });
});

// PUT /:id/meal-plan/:date — sætter (eller erstatter) rettens navn for én
// dato. Tomt navn sletter dagens ret i stedet for at gemme en tom streng —
// samme "ryd feltet"-UX som fx en opgaves timeOfDay.
mealPlan.put("/:id/meal-plan/:date", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const date = c.req.param("date");

  if (!isValidDateString(date)) {
    return c.json({ error: "Ugyldig dato." }, 400);
  }

  const body = await parseJsonBody<{ dishName: string }>(c);
  const dishName = body.dishName?.trim() ?? "";

  if (!dishName) {
    await c.env.DB.prepare("DELETE FROM meal_plan_entries WHERE family_id = ? AND date = ?")
      .bind(familyId, date)
      .run();

    return c.json({ entries: await listEntriesInRange(c.env.DB, familyId, date, date) });
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO meal_plan_entries (id, family_id, date, dish_name, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(family_id, date) DO UPDATE SET dish_name = excluded.dish_name`,
  )
    .bind(crypto.randomUUID(), familyId, date, dishName, c.get("user").id, now)
    .run();

  return c.json({ entries: await listEntriesInRange(c.env.DB, familyId, date, date) });
});

// POST /:id/meal-plan/generate-ingredients-draft — kalder AI-modulets
// eksisterende generateIngredientsDraft() én gang PR. RET i det angivne
// datointerval (ikke én samlet prompt for hele ugen — modellen er en let,
// hurtig model, se aiAssistant.ts, og er ikke afprøvet til at holde styr på
// flere retter i én prompt), samler resultaterne og fjerner dubletter på
// tværs af retter (fx to retter, der begge bruger løg), FØR udkastet vises
// til brugeren. Kategorien resolves mod den valgte listes egen type/
// selvlæring, samme funktion som den eksisterende
// generate-ingredients-draft-rute for en enkelt ret.
mealPlan.post("/:id/meal-plan/generate-ingredients-draft", async (c) => {
  const familyId = c.req.param("id");
  const list = await requireListInFamily(c, familyId, c.req.query("listId") ?? "");

  if (!list) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const startDate = c.req.query("startDate");
  const endDate = c.req.query("endDate");

  if (!startDate || !isValidDateString(startDate) || !endDate || !isValidDateString(endDate)) {
    return c.json({ error: "Ugyldigt datointerval." }, 400);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "ai-ingredients-draft",
    key: c.get("user").id,
    ...aiDraftRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  const entries = await listEntriesInRange(c.env.DB, familyId, startDate, endDate);

  if (entries.length === 0) {
    return c.json({ error: "Ingen retter i det valgte interval endnu." }, 400);
  }

  const draftsPerDish = await Promise.all(
    entries.map((entry) => generateIngredientsDraft(c.env, entry.dishName)),
  );

  // Samler alle retters forslag og fjerner dubletter på tværs (fx to
  // retter, der begge bruger "løg") — case-insensitivt på det trimmede
  // navn, første forekomst vinder rækkefølgen.
  const seenNames = new Set<string>();
  const combinedNames: string[] = [];

  for (const draft of draftsPerDish) {
    if (!draft) {
      continue;
    }

    for (const item of draft) {
      const key = item.name.trim().toLowerCase();

      if (key && !seenNames.has(key)) {
        seenNames.add(key);
        combinedNames.push(item.name.trim());
      }
    }
  }

  if (combinedNames.length === 0) {
    return c.json({ error: "Kunne ikke generere et forslag. Prøv igen." }, 502);
  }

  const draftWithCategories = await Promise.all(
    combinedNames.map(async (name) => ({
      name,
      category: await resolveCategory(c.env.DB, familyId, list.type, name),
    })),
  );

  return c.json({ items: draftWithCategories });
});

export default mealPlan;
