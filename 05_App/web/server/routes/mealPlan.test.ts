import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

const { default: mealPlan } = await import("./mealPlan");
const { default: shoppingLists } = await import("./shoppingLists");

interface MealPlanEntryDto {
  id: string;
  date: string;
  dishName: string;
  createdByUserId: string;
  createdAt: string;
}

interface ShoppingListDto {
  id: string;
  familyId: string;
  name: string;
  type: string;
  createdAt: string;
}

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  memberUserIds: string[],
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(familyId, "Testfamilien", memberUserIds[0], now)
    .run();

  for (const userId of memberUserIds) {
    await env.DB.prepare(
      "INSERT INTO family_memberships (family_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    )
      .bind(familyId, userId, userId === memberUserIds[0] ? "owner" : "member", now)
      .run();
  }
}

describe("mealPlan routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
  });

  it("requires login", async () => {
    const response = await mealPlan.request(
      "/family-1/meal-plan?startDate=2026-09-07&endDate=2026-09-13",
      {},
      env,
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for a family the user is not a member of", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });

    const response = await mealPlan.request(
      "/family-1/meal-plan?startDate=2026-09-07&endDate=2026-09-13",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("rejects an invalid date range", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await mealPlan.request(
      "/family-1/meal-plan?startDate=not-a-date&endDate=2026-09-13",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("sets, replaces, and clears a day's dish through PUT", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const setResponse = await mealPlan.request(
      "/family-1/meal-plan/2026-09-07",
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: "Spaghetti bolognese" }),
      },
      env,
    );
    const { entries: afterSet }: { entries: MealPlanEntryDto[] } = await setResponse.json();

    expect(setResponse.status).toBe(200);
    expect(afterSet).toHaveLength(1);
    expect(afterSet[0]!.dishName).toBe("Spaghetti bolognese");

    const replaceResponse = await mealPlan.request(
      "/family-1/meal-plan/2026-09-07",
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: "Tacofredag" }),
      },
      env,
    );
    const { entries: afterReplace }: { entries: MealPlanEntryDto[] } = await replaceResponse.json();

    // Erstatter, opretter ikke en ny række for samme dato (UNIQUE(family_id, date)).
    expect(afterReplace).toHaveLength(1);
    expect(afterReplace[0]!.dishName).toBe("Tacofredag");

    const clearResponse = await mealPlan.request(
      "/family-1/meal-plan/2026-09-07",
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: "" }),
      },
      env,
    );
    const { entries: afterClear }: { entries: MealPlanEntryDto[] } = await clearResponse.json();

    expect(afterClear).toHaveLength(0);
  });

  it("lists entries within a date range", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    for (const [date, dish] of [
      ["2026-09-07", "Frikadeller"],
      ["2026-09-08", "Tacofredag"],
      ["2026-09-20", "Uden for intervallet"],
    ]) {
      await mealPlan.request(
        `/family-1/meal-plan/${date}`,
        {
          method: "PUT",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ dishName: dish }),
        },
        env,
      );
    }

    const response = await mealPlan.request(
      "/family-1/meal-plan?startDate=2026-09-07&endDate=2026-09-13",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const { entries }: { entries: MealPlanEntryDto[] } = await response.json();

    expect(entries.map((entry) => entry.dishName)).toEqual(["Frikadeller", "Tacofredag"]);
  });

  it("generates a deduplicated ingredients draft across the week's dishes", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const { lists } = (await (
      await shoppingLists.request("/family-1/shopping-lists", { headers: { Cookie: cookieHeader } }, env)
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    await mealPlan.request(
      "/family-1/meal-plan/2026-09-07",
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: "Spaghetti bolognese" }),
      },
      env,
    );
    await mealPlan.request(
      "/family-1/meal-plan/2026-09-08",
      {
        method: "PUT",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dishName: "Løgsuppe" }),
      },
      env,
    );

    // To retter, der begge bruger "Løg" — skal kun optræde én gang i det
    // samlede udkast.
    env.AI.run = vi.fn(async (_model: unknown, options: { messages: { role: string; content: string }[] }) => {
      const dish = options.messages[1]!.content;
      const items =
        dish === "Spaghetti bolognese"
          ? [{ name: "Hakket oksekød" }, { name: "Løg" }]
          : [{ name: "løg" }, { name: "Bouillon" }];

      return { choices: [{ message: { content: JSON.stringify({ items }) } }] };
    }) as never;

    const response = await mealPlan.request(
      `/family-1/meal-plan/generate-ingredients-draft?listId=${listId}&startDate=2026-09-07&endDate=2026-09-13`,
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
    );
    const body: { items: { name: string; category: string }[] } = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.name)).toEqual(["Hakket oksekød", "Løg", "Bouillon"]);
  });

  it("returns 400 when no dishes are planned in the requested range", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const { lists } = (await (
      await shoppingLists.request("/family-1/shopping-lists", { headers: { Cookie: cookieHeader } }, env)
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    const response = await mealPlan.request(
      `/family-1/meal-plan/generate-ingredients-draft?listId=${listId}&startDate=2026-09-07&endDate=2026-09-13`,
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(400);
  });
});
