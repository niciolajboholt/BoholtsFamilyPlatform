// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  enqueueTaskToggle,
  listQueuedTaskToggles,
  removeQueuedTaskToggle,
} from "./offlineTaskQueueStorage";

describe("offlineTaskQueueStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is queued", () => {
    expect(listQueuedTaskToggles()).toEqual([]);
  });

  it("enqueues a toggle with a generated id and timestamp", () => {
    enqueueTaskToggle({ familyId: "family-1", taskId: "task-1", isDone: true });

    const queue = listQueuedTaskToggles();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ familyId: "family-1", taskId: "task-1", isDone: true });
    expect(queue[0]!.id).toEqual(expect.any(String));
    expect(queue[0]!.createdAt).toEqual(expect.any(String));
  });

  it("preserves FIFO order across multiple enqueues", () => {
    enqueueTaskToggle({ familyId: "f", taskId: "first", isDone: true });
    enqueueTaskToggle({ familyId: "f", taskId: "second", isDone: false });

    const queue = listQueuedTaskToggles();
    expect(queue.map((operation) => operation.taskId)).toEqual(["first", "second"]);
  });

  it("removes only the given operation", () => {
    enqueueTaskToggle({ familyId: "f", taskId: "stays", isDone: true });
    enqueueTaskToggle({ familyId: "f", taskId: "removed", isDone: true });

    const [, second] = listQueuedTaskToggles();
    removeQueuedTaskToggle(second!.id);

    const remaining = listQueuedTaskToggles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ taskId: "stays" });
  });

  it("falls back to an empty list when storage holds invalid JSON", () => {
    window.localStorage.setItem("boholts-family-offline-task-queue", "not valid json {{{");

    expect(listQueuedTaskToggles()).toEqual([]);
  });

  it("filters out malformed entries instead of throwing", () => {
    window.localStorage.setItem(
      "boholts-family-offline-task-queue",
      JSON.stringify([{ familyId: "f", taskId: "t" /* missing isDone */ }]),
    );

    expect(listQueuedTaskToggles()).toEqual([]);
  });
});
