import { describe, expect, it, vi } from "vitest";

import { raceWithTimeout } from "./GoogleCalendarSession";

describe("raceWithTimeout", () => {
  it("resolves with the promise's value when it settles before the timeout", async () => {
    const result = await raceWithTimeout(
      Promise.resolve("resolved"),
      1000,
      "timed-out",
    );

    expect(result).toBe("resolved");
  });

  it("resolves with the timeout value when the promise never settles in time", async () => {
    vi.useFakeTimers();

    const neverResolves = new Promise<string>(() => undefined);
    const resultPromise = raceWithTimeout(
      neverResolves,
      1000,
      "timed-out",
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expect(resultPromise).resolves.toBe("timed-out");

    vi.useRealTimers();
  });

  it("resolves with the timeout value instead of rejecting when the promise fails", async () => {
    const result = await raceWithTimeout(
      Promise.reject(new Error("boom")),
      1000,
      "fallback",
    );

    expect(result).toBe("fallback");
  });
});
