import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeEnv } from "../testing/fakeEnv";
import { seedLoggedInUser } from "../testing/fakeD1";

vi.mock("../lib/pushNotifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/pushNotifications")>();
  return { ...actual, sendPushNotificationToFamily: vi.fn().mockResolvedValue(undefined) };
});

const { sendPushNotificationToFamily } = await import("../lib/pushNotifications");
const { default: shoppingLists } = await import("./shoppingLists");

const sendPushNotificationToFamilyMock = vi.mocked(sendPushNotificationToFamily);

let lastWaitUntilTask: Promise<unknown> | undefined;
const fakeExecutionCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    lastWaitUntilTask = promise;
  },
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

interface ShoppingListDto {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
}

interface ShoppingListItemDto {
  id: string;
  listId: string;
  name: string;
  category: string;
  isChecked: number;
  addedByUserId: string;
  createdAt: string;
  checkedAt: string | null;
}

async function seedFamily(
  env: ReturnType<typeof createFakeEnv>,
  familyId: string,
  memberUserIds: string[],
): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)",
  )
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

describe("shopping list routes", () => {
  let env: ReturnType<typeof createFakeEnv>;

  beforeEach(() => {
    env = createFakeEnv();
    sendPushNotificationToFamilyMock.mockReset().mockResolvedValue(undefined);
    lastWaitUntilTask = undefined;
  });

  it("rejects any request without a session cookie", async () => {
    const response = await shoppingLists.request("/family-1/shopping-lists", {}, env);
    expect(response.status).toBe(401);
  });

  it("returns 404 for a family the user does not belong to", async () => {
    const { cookieHeader } = await seedLoggedInUser(env.DB as never, { id: "outsider" });

    const response = await shoppingLists.request(
      "/some-other-family/shopping-lists",
      { headers: { Cookie: cookieHeader } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("auto-creates a default list the first time a family's lists are requested", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await shoppingLists.request(
      "/family-1/shopping-lists",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const body: { lists: ShoppingListDto[] } = await response.json();

    expect(response.status).toBe(200);
    expect(body.lists).toHaveLength(1);
    expect(body.lists[0]?.name).toBe("Indkøbsliste");

    // Kaldt igen — samme liste, ikke en ny.
    const secondResponse = await shoppingLists.request(
      "/family-1/shopping-lists",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const secondBody: { lists: ShoppingListDto[] } = await secondResponse.json();
    expect(secondBody.lists).toHaveLength(1);
    expect(secondBody.lists[0]?.id).toBe(body.lists[0]?.id);
  });

  it("adds an item with an auto-guessed category and notifies the family", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    const { userId: otherUserId } = await seedLoggedInUser(env.DB as never, { id: "christine" });
    await seedFamily(env, "family-1", [userId, otherUserId]);

    const listsResponse = await shoppingLists.request(
      "/family-1/shopping-lists",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const { lists } = (await listsResponse.json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    const body: { items: ShoppingListItemDto[] } = await response.json();
    await lastWaitUntilTask;

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.category).toBe("Mejeri");
    expect(body.items[0]?.addedByUserId).toBe(userId);

    expect(sendPushNotificationToFamilyMock).toHaveBeenCalledWith(
      env,
      "family-1",
      userId,
      expect.objectContaining({ body: expect.stringContaining("Mælk") }),
    );
  });

  it("remembers a manually corrected category and applies it to the next matching item", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    // "Kokosvand" har intet nøgleord i ordbogen og lander i "Andet" — brugeren
    // retter det manuelt til "Frugt & grønt".
    await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Kokosvand", category: "Frugt & grønt" }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const secondResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "kokosvand" }),
      },
      env,
      fakeExecutionCtx,
    );
    const body: { items: ShoppingListItemDto[] } = await secondResponse.json();

    const secondItem = body.items.find((item) => item.name === "kokosvand");
    expect(secondItem?.category).toBe("Frugt & grønt");
  });

  it("toggles isChecked and sets/clears checkedAt", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    const addResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Æbler" }),
      },
      env,
      fakeExecutionCtx,
    );
    const { items } = (await addResponse.json()) as { items: ShoppingListItemDto[] };
    const itemId = items[0]!.id;

    const checkedResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked: true }),
      },
      env,
      fakeExecutionCtx,
    );
    const checkedBody = (await checkedResponse.json()) as { items: ShoppingListItemDto[] };
    expect(checkedBody.items[0]?.isChecked).toBe(1);
    expect(checkedBody.items[0]?.checkedAt).not.toBeNull();
  });

  it("deletes an item", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    const addResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Banan" }),
      },
      env,
      fakeExecutionCtx,
    );
    const { items } = (await addResponse.json()) as { items: ShoppingListItemDto[] };
    const itemId = items[0]!.id;

    const deleteResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items/${itemId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
      fakeExecutionCtx,
    );
    const body = (await deleteResponse.json()) as { items: ShoppingListItemDto[] };
    expect(body.items).toHaveLength(0);
  });

  it("clear-checked removes only checked items", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    async function addItem(name: string): Promise<string> {
      const response = await shoppingLists.request(
        `/family-1/shopping-lists/${listId}/items`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        env,
        fakeExecutionCtx,
      );
      const { items } = (await response.json()) as { items: ShoppingListItemDto[] };
      return items.find((item) => item.name === name)!.id;
    }

    await addItem("Mælk");
    const bananItemId = await addItem("Banan");

    await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items/${bananItemId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ isChecked: true }),
      },
      env,
      fakeExecutionCtx,
    );

    const clearResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/clear-checked`,
      { method: "POST", headers: { Cookie: cookieHeader } },
      env,
      fakeExecutionCtx,
    );
    const body = (await clearResponse.json()) as { items: ShoppingListItemDto[] };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe("Mælk");
  });

  it("returns 404 when the list belongs to a different family (cross-family isolation)", async () => {
    const { cookieHeader: ownerCookie, userId: ownerId } = await seedLoggedInUser(
      env.DB as never,
      { id: "owner" },
    );
    const { cookieHeader: outsiderCookie, userId: outsiderId } = await seedLoggedInUser(
      env.DB as never,
      { id: "outsider" },
    );
    await seedFamily(env, "family-1", [ownerId]);
    await seedFamily(env, "family-2", [outsiderId]);

    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: ownerCookie } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const listId = lists[0]!.id;

    // Den anden families medlem er ganske vist logget ind og medlem af SIN
    // egen familie ("family-2"), men prøver at tilgå family-1's liste.
    const response = await shoppingLists.request(
      `/family-2/shopping-lists/${listId}/items`,
      { headers: { Cookie: outsiderCookie } },
      env,
    );

    expect(response.status).toBe(404);
  });
});
