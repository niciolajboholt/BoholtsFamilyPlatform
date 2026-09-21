import { beforeEach, describe, expect, it } from "vitest";

import { createFakeEnv } from "../../testing/fakeEnv";
import { seedLoggedInUser } from "../../testing/fakeD1";

// Importeret via det samlede families-router (samme konvention som
// childAccessManagement.test.ts) — dækker også den delte session-middleware.
const { default: families } = await import("../families");

interface CreateFamilyResponse {
  family: { id: string };
}

async function createFamily(env: ReturnType<typeof createFakeEnv>, cookieHeader: string): Promise<string> {
  const response = await families.request(
    "/",
    { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json" } },
    env,
  );
  const body: CreateFamilyResponse = await response.json();
  return body.family.id;
}

async function toggleFeature(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
  familyId: string,
  featureKey: string,
  enabled: boolean,
): Promise<{ status: number; body: { features?: string[]; error?: string } }> {
  const response = await families.request(
    `/${familyId}/enabled-features/${featureKey}`,
    {
      method: "PUT",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
    env,
  );
  return { status: response.status, body: await response.json() };
}

async function getEnabledFeatures(
  env: ReturnType<typeof createFakeEnv>,
  cookieHeader: string,
  familyId: string,
): Promise<string[]> {
  const response = await families.request(`/${familyId}/enabled-features`, { headers: { Cookie: cookieHeader } }, env);
  const body: { features: string[] } = await response.json();
  return body.features;
}

// Sprint 57, afsnit B (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md):
// routines og task-rewards er meningsløse uden opgaver at knytte sig til.
// Håndhæves server-side i featureFlags.ts — disse tests dækker den
// afhængighedskaskade, som ellers ikke havde nogen automatiske tests.
describe("feature flag dependencies (routines/task-rewards kræver tasks)", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  it("slår tasks automatisk til, når routines slås til", async () => {
    const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
    const familyId = await createFamily(env, owner.cookieHeader);

    const result = await toggleFeature(env, owner.cookieHeader, familyId, "routines", true);

    expect(result.status).toBe(200);
    expect(result.body.features).toEqual(expect.arrayContaining(["routines", "tasks"]));
  });

  it("slår tasks automatisk til, når task-rewards slås til", async () => {
    const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
    const familyId = await createFamily(env, owner.cookieHeader);

    const result = await toggleFeature(env, owner.cookieHeader, familyId, "task-rewards", true);

    expect(result.status).toBe(200);
    expect(result.body.features).toEqual(expect.arrayContaining(["task-rewards", "tasks"]));
  });

  it("slår routines og task-rewards automatisk fra, når tasks slås fra", async () => {
    const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
    const familyId = await createFamily(env, owner.cookieHeader);

    await toggleFeature(env, owner.cookieHeader, familyId, "routines", true);
    await toggleFeature(env, owner.cookieHeader, familyId, "task-rewards", true);

    const result = await toggleFeature(env, owner.cookieHeader, familyId, "tasks", false);

    expect(result.status).toBe(200);
    expect(result.body.features).not.toEqual(expect.arrayContaining(["tasks"]));
    expect(result.body.features).not.toEqual(expect.arrayContaining(["routines"]));
    expect(result.body.features).not.toEqual(expect.arrayContaining(["task-rewards"]));
  });

  it("lader tasks stå til, hvis kun routines slås fra igen", async () => {
    const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
    const familyId = await createFamily(env, owner.cookieHeader);

    await toggleFeature(env, owner.cookieHeader, familyId, "routines", true);
    const result = await toggleFeature(env, owner.cookieHeader, familyId, "routines", false);

    expect(result.status).toBe(200);
    expect(result.body.features).toEqual(expect.arrayContaining(["tasks"]));
    expect(result.body.features).not.toEqual(expect.arrayContaining(["routines"]));
  });

  it("selv-helbreder en tidligere ugyldig gemt tilstand (routines uden tasks) ved læsning", async () => {
    const owner = await seedLoggedInUser(env.DB as never, { id: "owner" });
    const familyId = await createFamily(env, owner.cookieHeader);

    // Simulerer data gemt før denne validering fandtes: indsæt routines
    // direkte i tabellen uden om PUT-ruten, altså uden tasks.
    await env.DB.prepare(
      `INSERT INTO family_enabled_features (family_id, feature_key, enabled_by_user_id, enabled_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(familyId, "routines", owner.userId, new Date().toISOString())
      .run();

    const features = await getEnabledFeatures(env, owner.cookieHeader, familyId);

    expect(features).toEqual(expect.arrayContaining(["routines", "tasks"]));
  });
});
