import { describe, expect, it, vi } from "vitest";

import { logError } from "./structuredLog";

describe("logError", () => {
  it("writes searchable JSON without serializing an Error object as empty", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("Kalender fejlede", new Error("token udløbet"), {
      familyId: "family-1",
    });

    expect(JSON.parse(String(spy.mock.calls[0][0]))).toEqual({
      message: "Kalender fejlede",
      familyId: "family-1",
      error: "token udløbet",
    });
    spy.mockRestore();
  });
});
