// Lader en familie slå de nyere, valgfrie funktioner til/fra under
// Indstillinger → "Flere funktioner" — se
// 0027_feature_flags.sql-migrationens kommentar. Nøglelisten holdes
// bevidst som en fast allow-list her (ikke fritekst), så en klient ikke
// kan booke en vilkårlig streng ind i tabellen. Listen duplikeres
// client-side (src/features/family/featureFlags.ts) for visning — samme
// duplikerings-konvention som resten af projektet (fx birthdayGiftPlans.ts's
// assertValidMember).

import { Hono } from "hono";

import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { parseJsonBody, type Variables } from "./familyQueries";

const featureFlags = new Hono<{ Bindings: Env; Variables: Variables }>();

export const knownFeatureKeys = [
  "meal-plan",
  "task-rewards",
  "birthdays",
  "shared-expenses",
  "kiosk",
] as const;

export type FeatureKey = (typeof knownFeatureKeys)[number];

function isKnownFeatureKey(value: string): value is FeatureKey {
  return (knownFeatureKeys as readonly string[]).includes(value);
}

async function listEnabledFeatures(db: D1Database, familyId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT feature_key AS featureKey FROM family_enabled_features WHERE family_id = ?")
    .bind(familyId)
    .all<{ featureKey: string }>();

  return results.map((row) => row.featureKey);
}

featureFlags.get("/:id/enabled-features", async (c) => {
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, c.get("user").id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  return c.json({ features: await listEnabledFeatures(c.env.DB, familyId) });
});

// Kun ejer/admin — samme rolle-adgang som resten af familiens indstillinger
// (fx familySettings.ts's ugeresumé-opdatering, calendarMappings.ts).
featureFlags.put("/:id/enabled-features/:featureKey", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const featureKey = c.req.param("featureKey");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Kun ejer/admin kan ændre dette." }, 403);
  }

  if (!isKnownFeatureKey(featureKey)) {
    return c.json({ error: "Ukendt funktion." }, 400);
  }

  const body = await parseJsonBody<{ enabled: boolean }>(c);

  if (body.enabled) {
    await c.env.DB.prepare(
      `INSERT INTO family_enabled_features (family_id, feature_key, enabled_by_user_id, enabled_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (family_id, feature_key) DO NOTHING`,
    )
      .bind(familyId, featureKey, user.id, new Date().toISOString())
      .run();
  } else {
    await c.env.DB.prepare(
      "DELETE FROM family_enabled_features WHERE family_id = ? AND feature_key = ?",
    )
      .bind(familyId, featureKey)
      .run();
  }

  return c.json({ features: await listEnabledFeatures(c.env.DB, familyId) });
});

export default featureFlags;
