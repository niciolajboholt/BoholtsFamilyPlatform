// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  enqueueShoppingOperation,
  listQueuedShoppingOperations,
  removeQueuedShoppingOperation,
} from "./offlineShoppingQueueStorage";

describe("offlineShoppingQueueStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is queued", () => {
    expect(listQueuedShoppingOperations()).toEqual([]);
  });

  it("enqueues an add-item operation with a generated id and timestamp", () => {
    enqueueShoppingOperation({
      type: "add-item",
      familyId: "family-1",
      listId: "list-1",
      name: "Mælk",
    });

    const queue = listQueuedShoppingOperations();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      type: "add-item",
      familyId: "family-1",
      listId: "list-1",
      name: "Mælk",
    });
    expect(queue[0]!.id).toEqual(expect.any(String));
    expect(queue[0]!.createdAt).toEqual(expect.any(String));
  });

  it("enqueues a toggle-item operation", () => {
    enqueueShoppingOperation({
      type: "toggle-item",
      familyId: "family-1",
      listId: "list-1",
      itemId: "item-1",
      isChecked: true,
    });

    const queue = listQueuedShoppingOperations();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      type: "toggle-item",
      itemId: "item-1",
      isChecked: true,
    });
  });

  it("preserves FIFO order across multiple enqueues", () => {
    enqueueShoppingOperation({ type: "add-item", familyId: "f", listId: "l", name: "Først" });
    enqueueShoppingOperation({ type: "add-item", familyId: "f", listId: "l", name: "Sidst" });

    const queue = listQueuedShoppingOperations();
    expect(queue.map((operation) => (operation.type === "add-item" ? operation.name : null))).toEqual([
      "Først",
      "Sidst",
    ]);
  });

  it("removes only the given operation", () => {
    enqueueShoppingOperation({ type: "add-item", familyId: "f", listId: "l", name: "Bliver" });
    enqueueShoppingOperation({ type: "add-item", familyId: "f", listId: "l", name: "Fjernes" });

    const [, second] = listQueuedShoppingOperations();
    removeQueuedShoppingOperation(second!.id);

    const remaining = listQueuedShoppingOperations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ name: "Bliver" });
  });

  it("falls back to an empty list when storage holds invalid JSON", () => {
    window.localStorage.setItem("boholts-family-offline-shopping-queue", "not valid json {{{");

    expect(listQueuedShoppingOperations()).toEqual([]);
  });

  it("filters out malformed entries instead of throwing", () => {
    window.localStorage.setItem(
      "boholts-family-offline-shopping-queue",
      JSON.stringify([{ type: "add-item", familyId: "f", listId: "l" /* missing name */ }]),
    );

    expect(listQueuedShoppingOperations()).toEqual([]);
  });
});
