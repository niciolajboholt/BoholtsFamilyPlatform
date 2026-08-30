import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import {
  computeCurrentWeekStart,
  addDays,
  generateWeeklySummaryForFamily,
  getCopenhagenDateString,
} from "../../lib/weeklySummary";
import { parseJsonBody, type Variables } from "./familyQueries";

const familySettings = new Hono<{ Bindings: Env; Variables: Variables }>();

// Nyeste gemte AI-ugeresumé (Sprint 28) — genereret ugentligt af
// server/lib/weeklySummary.ts's Cron Trigger, ikke on-demand her.
familySettings.get("/:id/weekly-summary", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke medlem af denne familie." }, 403);
  }

  const summary = await c.env.DB.prepare(
    `SELECT week_start AS weekStart, content, created_at AS createdAt
     FROM family_weekly_summaries WHERE family_id = ? ORDER BY week_start DESC LIMIT 1`,
  )
    .bind(familyId)
    .first<{ weekStart: string; content: string; createdAt: string }>();

  return c.json({ summary: summary ?? null });
});

const WEEKLY_SUMMARY_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

// Brugerudløst opdatering (samme rolle-adgang som resten af familiens
// indstillinger: ejer eller admin, ikke kun ejeren). Genererer et frisk
// resumé for DEN UGE, MAN ER I NU — ikke den kommende uge, som cron'en
// (se weeklySummary.ts) altid ser fremad mod, da den kører søndag aften.
// Overskriver et evt. eksisterende resumé for samme uge (`ON CONFLICT` i
// generateWeeklySummaryForFamily), i stedet for at cron-jobbets "spring
// over, hvis der allerede findes et"-idempotens gælder her.
familySettings.post("/:id/weekly-summary/refresh", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan opdatere ugens resumé." }, 403);
  }

  const family = await c.env.DB.prepare(
    "SELECT id, owner_user_id AS ownerUserId, ai_weekly_summary_enabled AS aiWeeklySummaryEnabled FROM families WHERE id = ?",
  )
    .bind(familyId)
    .first<{ id: string; ownerUserId: string; aiWeeklySummaryEnabled: number }>();

  if (!family || family.aiWeeklySummaryEnabled !== 1) {
    return c.json({ error: "AI-ugeresumé er ikke slået til for denne familie." }, 400);
  }

  const latest = await c.env.DB.prepare(
    "SELECT created_at AS createdAt FROM family_weekly_summaries WHERE family_id = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(familyId)
    .first<{ createdAt: string }>();

  if (latest && Date.now() - new Date(latest.createdAt).getTime() < WEEKLY_SUMMARY_REFRESH_COOLDOWN_MS) {
    return c.json(
      { error: "Ugens resumé blev lige opdateret. Prøv igen om lidt." },
      429,
    );
  }

  const weekStart = computeCurrentWeekStart(getCopenhagenDateString(new Date()));
  const weekEnd = addDays(weekStart, 6);

  const outcome = await generateWeeklySummaryForFamily(c.env, family, weekStart, weekEnd);

  if (outcome.status === "no-data") {
    return c.json({ error: "Intet at opsummere lige nu — ingen aftaler, opgaver eller indkøbsvarer." }, 400);
  }

  if (outcome.status === "generation-failed") {
    return c.json({ error: "Kunne ikke generere resuméet. Prøv igen om lidt." }, 502);
  }

  return c.json({ summary: { weekStart, content: outcome.content, createdAt: new Date().toISOString() } });
});

// Privatlivsvalg for automatisk AI-behandling — ejer/admin, da indstillingen
// gælder hele familiens kalender-, opgave- og indkøbsdata.
familySettings.patch("/:id/privacy-settings", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer eller admin kan ændre familiens privatlivsvalg." }, 403);
  }

  const body = await parseJsonBody<{ aiWeeklySummaryEnabled: boolean }>(c);
  if (typeof body.aiWeeklySummaryEnabled !== "boolean") {
    return c.json({ error: "AI-indstillingen skal være sand eller falsk." }, 400);
  }

  await c.env.DB.prepare("UPDATE families SET ai_weekly_summary_enabled = ? WHERE id = ?")
    .bind(body.aiWeeklySummaryEnabled ? 1 : 0, familyId)
    .run();

  return c.json({ aiWeeklySummaryEnabled: body.aiWeeklySummaryEnabled });
});

export default familySettings;
