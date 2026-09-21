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
  "shopping-list",
  "tasks",
  "routines",
  "meal-plan",
  "task-rewards",
  "birthdays",
  "shared-expenses",
  "kiosk",
  "mit-i-dag",
] as const;

export type FeatureKey = (typeof knownFeatureKeys)[number];

function isKnownFeatureKey(value: string): value is FeatureKey {
  return (knownFeatureKeys as readonly string[]).includes(value);
}

// Sprint 57: routines og task-rewards er meningsløse uden opgaver at
// knytte sig til — se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md,
// afsnit B. Nøglet på selve featuren (ikke en fritekst-liste), så en
// fremtidig ny underfunktion blot skal tilføjes her. Håndhæves
// udelukkende her, atomisk i samme D1 batch som selve skriveoperationen —
// klienten er en ren visning af serverens svar.
const featureDependency: Partial<Record<FeatureKey, FeatureKey>> = {
  routines: "tasks",
  "task-rewards": "tasks",
};

function dependentsOf(key: FeatureKey): FeatureKey[] {
  return (Object.entries(featureDependency) as [FeatureKey, FeatureKey][])
    .filter(([, required]) => required === key)
    .map(([dependent]) => dependent);
}

async function listEnabledFeatures(db: D1Database, familyId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT feature_key AS featureKey FROM family_enabled_features WHERE family_id = ?")
    .bind(familyId)
    .all<{ featureKey: string }>();

  return results.map((row) => row.featureKey);
}

// Retter en allerede gemt ugyldig tilstand (routines/task-rewards aktive
// uden tasks) — kan opstå for familier, der aktiverede en underfunktion,
// før denne validering fandtes. Tilføjer den manglende hovedfunktion i
// stedet for at fjerne underfunktionen, så familien ikke mister noget de
// aktivt har slået til. Kaldes ved hver læsning, så en gammel, ugyldig
// tilstand selv-helbreder uden en migration eller manuel oprydning.
async function healMissingFeatureDependencies(
  db: D1Database,
  familyId: string,
  actingUserId: string,
): Promise<string[]> {
  const enabled = new Set(await listEnabledFeatures(db, familyId));
  const missing = new Set<FeatureKey>();

  for (const [dependent, required] of Object.entries(featureDependency) as [FeatureKey, FeatureKey][]) {
    if (enabled.has(dependent) && !enabled.has(required)) {
      missing.add(required);
    }
  }

  if (missing.size === 0) {
    return [...enabled];
  }

  const now = new Date().toISOString();

  await db.batch(
    [...missing].map((key) =>
      db
        .prepare(
          `INSERT INTO family_enabled_features (family_id, feature_key, enabled_by_user_id, enabled_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (family_id, feature_key) DO NOTHING`,
        )
        .bind(familyId, key, actingUserId, now),
    ),
  );

  return listEnabledFeatures(db, familyId);
}

featureFlags.get("/:id/enabled-features", async (c) => {
  const familyId = c.req.param("id");
  const user = c.get("user");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  return c.json({ features: await healMissingFeatureDependencies(c.env.DB, familyId, user.id) });
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
  const now = new Date().toISOString();

  if (body.enabled) {
    // Aktivering af en underfunktion aktiverer også dens hovedfunktion,
    // hvis den ikke allerede er slået til — atomisk i samme batch.
    const required = featureDependency[featureKey];
    const keysToEnable = new Set<FeatureKey>([featureKey]);
    if (required) {
      keysToEnable.add(required);
    }

    await c.env.DB.batch(
      [...keysToEnable].map((key) =>
        c.env.DB.prepare(
          `INSERT INTO family_enabled_features (family_id, feature_key, enabled_by_user_id, enabled_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (family_id, feature_key) DO NOTHING`,
        ).bind(familyId, key, user.id, now),
      ),
    );
  } else {
    // Deaktivering af en hovedfunktion deaktiverer også dens
    // underfunktioner (hvis aktive) — atomisk i samme batch, så familien
    // aldrig efterlades i en tilstand med fx routines aktiv uden tasks.
    const keysToDisable = new Set<FeatureKey>([featureKey, ...dependentsOf(featureKey)]);

    await c.env.DB.batch(
      [...keysToDisable].map((key) =>
        c.env.DB.prepare("DELETE FROM family_enabled_features WHERE family_id = ? AND feature_key = ?").bind(
          familyId,
          key,
        ),
      ),
    );
  }

  return c.json({ features: await listEnabledFeatures(c.env.DB, familyId) });
});

export default featureFlags;
