// Sprint 40 (se
// 01_Project_Documentation/Development/40_Sprint40_Foedselsdag_Gaveplanlaegning_Plan.md
// og ADR-020): gaveideer og budget knyttet til familiemedlemmers
// fødselsdage. En gaveplan for medlem X skjules server-side for X selv,
// hvis X har en koblet konto (linked_user_id) — ellers ødelægges
// overraskelsen. Filtreringen sker ved LÆSNING, uanset hvem der oprettede
// planen, ikke kun for andre end forfatteren.

import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { parseJsonBody, type Variables } from "./familyQueries";

const birthdayGiftPlans = new Hono<{ Bindings: Env; Variables: Variables }>();

export interface BirthdayGiftPlanRow {
  id: string;
  familyId: string;
  familyMemberId: string;
  year: number;
  giftIdea: string;
  budgetAmount: number | null;
  isPurchased: number;
  createdByUserId: string;
  createdAt: string;
}

// Kun planer for medlemmer, der IKKE er koblet til den forespørgende
// bruger selv — se filoverskriftens begrundelse. Et medlem uden konto
// (fx et barn) har intet at skjule det for.
async function listVisibleGiftPlans(
  db: D1Database,
  familyId: string,
  requestingUserId: string,
): Promise<BirthdayGiftPlanRow[]> {
  const result = await db
    .prepare(
      `SELECT birthday_gift_plans.id AS id, birthday_gift_plans.family_id AS familyId,
              birthday_gift_plans.family_member_id AS familyMemberId, birthday_gift_plans.year AS year,
              birthday_gift_plans.gift_idea AS giftIdea, birthday_gift_plans.budget_amount AS budgetAmount,
              birthday_gift_plans.is_purchased AS isPurchased,
              birthday_gift_plans.created_by_user_id AS createdByUserId,
              birthday_gift_plans.created_at AS createdAt
       FROM birthday_gift_plans
       JOIN family_members ON family_members.id = birthday_gift_plans.family_member_id
       WHERE birthday_gift_plans.family_id = ?
         AND (family_members.linked_user_id IS NULL OR family_members.linked_user_id != ?)
       ORDER BY birthday_gift_plans.year DESC, birthday_gift_plans.created_at ASC`,
    )
    .bind(familyId, requestingUserId)
    .all<BirthdayGiftPlanRow>();

  return result.results;
}

async function assertValidMember(db: D1Database, familyId: string, memberId: string): Promise<boolean> {
  const member = await db
    .prepare("SELECT id FROM family_members WHERE id = ? AND family_id = ?")
    .bind(memberId, familyId)
    .first();

  return Boolean(member);
}

birthdayGiftPlans.get("/:id/birthday-gift-plans", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const plans = await listVisibleGiftPlans(c.env.DB, familyId, user.id);

  return c.json({ plans });
});

birthdayGiftPlans.post("/:id/birthday-gift-plans", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    familyMemberId: string;
    year: number;
    giftIdea: string;
    budgetAmount?: number | null;
  }>(c);

  const giftIdea = body.giftIdea?.trim();

  if (!giftIdea) {
    return c.json({ error: "Skriv en gaveide." }, 400);
  }

  if (!body.familyMemberId || !(await assertValidMember(c.env.DB, familyId, body.familyMemberId))) {
    return c.json({ error: "Ukendt familiemedlem." }, 400);
  }

  if (typeof body.year !== "number" || !Number.isInteger(body.year) || body.year < 2000 || body.year > 2100) {
    return c.json({ error: "Ugyldigt år." }, 400);
  }

  if (
    body.budgetAmount !== undefined &&
    body.budgetAmount !== null &&
    (!Number.isInteger(body.budgetAmount) || body.budgetAmount < 0)
  ) {
    return c.json({ error: "Ugyldigt budget." }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO birthday_gift_plans
       (id, family_id, family_member_id, year, gift_idea, budget_amount, is_purchased, created_by_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      familyId,
      body.familyMemberId,
      body.year,
      giftIdea,
      body.budgetAmount ?? null,
      user.id,
      new Date().toISOString(),
    )
    .run();

  const plans = await listVisibleGiftPlans(c.env.DB, familyId, user.id);

  return c.json({ plans });
});

birthdayGiftPlans.patch("/:id/birthday-gift-plans/:planId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const planId = c.req.param("planId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const plan = await c.env.DB.prepare(
    "SELECT id FROM birthday_gift_plans WHERE id = ? AND family_id = ?",
  )
    .bind(planId, familyId)
    .first();

  if (!plan) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const body = await parseJsonBody<{
    giftIdea?: string;
    budgetAmount?: number | null;
    isPurchased?: boolean;
  }>(c);

  if (body.giftIdea !== undefined) {
    const trimmed = body.giftIdea.trim();

    if (!trimmed) {
      return c.json({ error: "Skriv en gaveide." }, 400);
    }

    await c.env.DB.prepare("UPDATE birthday_gift_plans SET gift_idea = ? WHERE id = ?")
      .bind(trimmed, planId)
      .run();
  }

  if (body.budgetAmount !== undefined) {
    if (body.budgetAmount !== null && (!Number.isInteger(body.budgetAmount) || body.budgetAmount < 0)) {
      return c.json({ error: "Ugyldigt budget." }, 400);
    }

    await c.env.DB.prepare("UPDATE birthday_gift_plans SET budget_amount = ? WHERE id = ?")
      .bind(body.budgetAmount, planId)
      .run();
  }

  if (body.isPurchased !== undefined) {
    await c.env.DB.prepare("UPDATE birthday_gift_plans SET is_purchased = ? WHERE id = ?")
      .bind(body.isPurchased ? 1 : 0, planId)
      .run();
  }

  const plans = await listVisibleGiftPlans(c.env.DB, familyId, user.id);

  return c.json({ plans });
});

birthdayGiftPlans.delete("/:id/birthday-gift-plans/:planId", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const planId = c.req.param("planId");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const plan = await c.env.DB.prepare(
    "SELECT id FROM birthday_gift_plans WHERE id = ? AND family_id = ?",
  )
    .bind(planId, familyId)
    .first();

  if (!plan) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  await c.env.DB.prepare("DELETE FROM birthday_gift_plans WHERE id = ?").bind(planId).run();

  const plans = await listVisibleGiftPlans(c.env.DB, familyId, user.id);

  return c.json({ plans });
});

export default birthdayGiftPlans;
