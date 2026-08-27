// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ShoppingListItemDto } from "../shoppingListApi";
import { groupItemsByCategory, shareItemsAsText } from "./shoppingListPageHelpers";

function buildItem(overrides: Partial<ShoppingListItemDto> = {}): ShoppingListItemDto {
  return {
    id: "item-1",
    listId: "list-1",
    name: "Mælk",
    category: "Køl",
    isChecked: 0,
    addedByUserId: "user-1",
    createdAt: "2026-08-27T00:00:00.000Z",
    checkedAt: null,
    ...overrides,
  };
}

describe("groupItemsByCategory", () => {
  it("groups items by category, preserving insertion order within a group", () => {
    const milk = buildItem({ id: "1", name: "Mælk", category: "Køl" });
    const bread = buildItem({ id: "2", name: "Brød", category: "Bagværk" });
    const cheese = buildItem({ id: "3", name: "Ost", category: "Køl" });

    const groups = groupItemsByCategory([milk, bread, cheese]);

    expect(Array.from(groups.keys())).toEqual(["Køl", "Bagværk"]);
    expect(groups.get("Køl")).toEqual([milk, cheese]);
    expect(groups.get("Bagværk")).toEqual([bread]);
  });

  it("returns an empty map for an empty item list", () => {
    expect(groupItemsByCategory([]).size).toBe(0);
  });
});

describe("shareItemsAsText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares only unchecked items via the Web Share API when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });

    const items = [
      buildItem({ id: "1", name: "Mælk", isChecked: 0 }),
      buildItem({ id: "2", name: "Ost", isChecked: 1 }),
      buildItem({ id: "3", name: "Brød", isChecked: 0 }),
    ];

    await shareItemsAsText(items);

    expect(share).toHaveBeenCalledWith({
      text: "Indkøbsliste:\n- Mælk\n- Brød",
    });
  });

  it("falls back to the clipboard when the Web Share API is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share: undefined, clipboard: { writeText } });

    await shareItemsAsText([buildItem({ name: "Mælk", isChecked: 0 })]);

    expect(writeText).toHaveBeenCalledWith("Indkøbsliste:\n- Mælk");
  });
});
