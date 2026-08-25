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
  type: string;
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

interface ShoppingListTemplateDto {
  id: string;
  listType: string;
  name: string;
  createdAt: string;
  itemNames: string[];
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

  it("auto-created default list has type dagligvarer", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await shoppingLists.request(
      "/family-1/shopping-lists",
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const body: { lists: ShoppingListDto[] } = await response.json();

    expect(body.lists[0]?.type).toBe("dagligvarer");
  });

  it("creates a new list with an explicit type", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await shoppingLists.request(
      "/family-1/shopping-lists",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bauhaus", type: "byggemarked" }),
      },
      env,
    );
    const body: { list: ShoppingListDto } = await response.json();

    expect(response.status).toBe(200);
    expect(body.list.name).toBe("Bauhaus");
    expect(body.list.type).toBe("byggemarked");
  });

  it("rejects creating a list without a valid type", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const response = await shoppingLists.request(
      "/family-1/shopping-lists",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bauhaus", type: "ukendt-type" }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("guesses categories from the byggemarked dictionary for a byggemarked-typed list", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const createResponse = await shoppingLists.request(
      "/family-1/shopping-lists",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bauhaus", type: "byggemarked" }),
      },
      env,
    );
    const { list } = (await createResponse.json()) as { list: ShoppingListDto };

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${list.id}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hammer" }),
      },
      env,
      fakeExecutionCtx,
    );
    const body: { items: ShoppingListItemDto[] } = await response.json();
    await lastWaitUntilTask;

    expect(body.items[0]?.category).toBe("Værktøj");
  });

  it("scopes category overrides per list type, not just per family", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);

    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const dagligvarerListId = lists[0]!.id;

    const createResponse = await shoppingLists.request(
      "/family-1/shopping-lists",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bauhaus", type: "byggemarked" }),
      },
      env,
    );
    const { list: byggemarkedList } = (await createResponse.json()) as { list: ShoppingListDto };

    // Retter "olie" til "Mejeri" på dagligvarer-listen — skal ikke smitte
    // af på byggemarked-listens gæt for samme varenavn.
    await shoppingLists.request(
      `/family-1/shopping-lists/${dagligvarerListId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Olie", category: "Mejeri" }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const byggemarkedResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${byggemarkedList.id}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Olie" }),
      },
      env,
      fakeExecutionCtx,
    );
    const byggemarkedBody: { items: ShoppingListItemDto[] } = await byggemarkedResponse.json();
    await lastWaitUntilTask;

    expect(byggemarkedBody.items[0]?.category).toBe("Andet");
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

  it("renames a list", async () => {
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

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bilka" }),
      },
      env,
    );
    const body: { list: ShoppingListDto } = await response.json();

    expect(response.status).toBe(200);
    expect(body.list.name).toBe("Bilka");

    const { lists: listsAfter } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    expect(listsAfter[0]?.name).toBe("Bilka");
  });

  it("rejects renaming a list to an empty name", async () => {
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

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "   " }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("updates a list's type", async () => {
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

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "byggemarked" }),
      },
      env,
    );
    const body: { list: ShoppingListDto } = await response.json();

    expect(response.status).toBe(200);
    expect(body.list.type).toBe("byggemarked");
    // Navnet skal forblive uændret, når kun typen sendes med.
    expect(body.list.name).toBe(lists[0]!.name);
  });

  it("rejects updating a list to an invalid type", async () => {
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

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ukendt-type" }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("deletes a list and its items, returning the remaining lists", async () => {
    const { cookieHeader, userId } = await seedLoggedInUser(env.DB as never, { id: "nicolaj" });
    await seedFamily(env, "family-1", [userId]);
    const { lists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const firstListId = lists[0]!.id;

    await shoppingLists.request(
      `/family-1/shopping-lists/${firstListId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const secondListResponse = await shoppingLists.request(
      "/family-1/shopping-lists",
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Byggemarked", type: "byggemarked" }),
      },
      env,
    );
    const { list: secondList } = (await secondListResponse.json()) as { list: ShoppingListDto };

    const deleteResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${firstListId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    const deleteBody: { lists: ShoppingListDto[] } = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.lists).toEqual([expect.objectContaining({ id: secondList.id })]);

    const remainingItems = await env.DB.prepare("SELECT * FROM shopping_list_items WHERE list_id = ?")
      .bind(firstListId)
      .all();
    expect(remainingItems.results).toHaveLength(0);
  });

  it("deleting a family's last list leaves them with none, ready to auto-recreate on next fetch", async () => {
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

    const deleteResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    const deleteBody: { lists: ShoppingListDto[] } = await deleteResponse.json();
    expect(deleteBody.lists).toEqual([]);

    // Næste hentning af familiens lister opretter automatisk en ny standardliste.
    const { lists: listsAfter } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: cookieHeader } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    expect(listsAfter).toHaveLength(1);
    expect(listsAfter[0]?.id).not.toBe(listId);
  });

  it("does not let a list from one family be deleted via another family's request", async () => {
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

    const response = await shoppingLists.request(
      `/family-2/shopping-lists/${listId}`,
      { method: "DELETE", headers: { Cookie: outsiderCookie } },
      env,
    );

    expect(response.status).toBe(404);
  });

  it("renames an item without changing its category", async () => {
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
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    const { items } = (await addResponse.json()) as { items: ShoppingListItemDto[] };
    const itemId = items[0]!.id;
    await lastWaitUntilTask;

    const renameResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sødmælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    const body: { items: ShoppingListItemDto[] } = await renameResponse.json();

    expect(renameResponse.status).toBe(200);
    expect(body.items[0]?.name).toBe("Sødmælk");
    expect(body.items[0]?.category).toBe("Mejeri");
  });

  it("rejects renaming an item to an empty name", async () => {
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
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    const { items } = (await addResponse.json()) as { items: ShoppingListItemDto[] };
    const itemId = items[0]!.id;
    await lastWaitUntilTask;

    const renameResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "  " }),
      },
      env,
      fakeExecutionCtx,
    );

    expect(renameResponse.status).toBe(400);
  });

  it("generates an ingredients draft from a dish name, categorized by the existing dictionary", async () => {
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

    env.AI.run = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ items: [{ name: "Hakket oksekød" }, { name: "Løg" }] }),
          },
        },
      ],
    }) as never;

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/generate-ingredients-draft`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dish: "spaghetti bolognese" }),
      },
      env,
    );
    const body: { items: { name: string; category: string }[] } = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      { name: "Hakket oksekød", category: "Kød" },
      { name: "Løg", category: "Frugt & grønt" },
    ]);
  });

  it("returns 502 when the AI response cannot be parsed as an ingredients draft", async () => {
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

    env.AI.run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Det ved jeg desværre ikke." } }],
    }) as never;

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/generate-ingredients-draft`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ dish: "noget uklart" }),
      },
      env,
    );

    expect(response.status).toBe(502);
  });

  it("rate-limits repeated calls to the AI ingredients draft route", async () => {
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

    env.AI.run = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ items: [{ name: "Løg" }] }) } }],
    }) as never;

    let lastResponse: Response | undefined;
    for (let i = 0; i < 21; i++) {
      lastResponse = await shoppingLists.request(
        `/family-1/shopping-lists/${listId}/generate-ingredients-draft`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ dish: "løgsuppe" }),
        },
        env,
      );
    }

    expect(lastResponse?.status).toBe(429);
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

  it("saves the current list's items as a template and lists it back", async () => {
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

    for (const name of ["Mælk", "Æg"]) {
      await shoppingLists.request(
        `/family-1/shopping-lists/${listId}/items`,
        {
          method: "POST",
          headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        env,
        fakeExecutionCtx,
      );
      await lastWaitUntilTask;
    }

    const saveResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/templates`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ugens faste" }),
      },
      env,
    );
    const saveBody: { templates: ShoppingListTemplateDto[] } = await saveResponse.json();

    expect(saveResponse.status).toBe(200);
    expect(saveBody.templates).toHaveLength(1);
    expect(saveBody.templates[0]?.name).toBe("Ugens faste");
    expect(saveBody.templates[0]?.itemNames.sort()).toEqual(["Mælk", "Æg"].sort());

    const listResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/templates`,
      { headers: { Cookie: cookieHeader } },
      env,
    );
    const listBody: { templates: ShoppingListTemplateDto[] } = await listResponse.json();

    expect(listBody.templates).toHaveLength(1);
  });

  it("rejects saving a template from an empty list", async () => {
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

    const response = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/templates`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Tom skabelon" }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it("deletes a template", async () => {
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

    await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/items`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const saveResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/templates`,
      {
        method: "POST",
        headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ugens faste" }),
      },
      env,
    );
    const { templates } = (await saveResponse.json()) as { templates: ShoppingListTemplateDto[] };
    const templateId = templates[0]!.id;

    const deleteResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${listId}/templates/${templateId}`,
      { method: "DELETE", headers: { Cookie: cookieHeader } },
      env,
    );
    const deleteBody: { templates: ShoppingListTemplateDto[] } = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.templates).toHaveLength(0);
  });

  it("does not let a template from one family be deleted via another family's request", async () => {
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

    const { lists: ownerLists } = (await (
      await shoppingLists.request(
        "/family-1/shopping-lists",
        { headers: { Cookie: ownerCookie } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const ownerListId = ownerLists[0]!.id;

    await shoppingLists.request(
      `/family-1/shopping-lists/${ownerListId}/items`,
      {
        method: "POST",
        headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Mælk" }),
      },
      env,
      fakeExecutionCtx,
    );
    await lastWaitUntilTask;

    const saveResponse = await shoppingLists.request(
      `/family-1/shopping-lists/${ownerListId}/templates`,
      {
        method: "POST",
        headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Ugens faste" }),
      },
      env,
    );
    const { templates } = (await saveResponse.json()) as { templates: ShoppingListTemplateDto[] };
    const templateId = templates[0]!.id;

    const { lists: outsiderLists } = (await (
      await shoppingLists.request(
        "/family-2/shopping-lists",
        { headers: { Cookie: outsiderCookie } },
        env,
      )
    ).json()) as { lists: ShoppingListDto[] };
    const outsiderListId = outsiderLists[0]!.id;

    const deleteResponse = await shoppingLists.request(
      `/family-2/shopping-lists/${outsiderListId}/templates/${templateId}`,
      { method: "DELETE", headers: { Cookie: outsiderCookie } },
      env,
    );

    expect(deleteResponse.status).toBe(404);
  });
});
