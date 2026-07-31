// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { createDataBackup, restoreDataBackup } from "./dataBackupStorage";

describe("dataBackupStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("collects only keys with the app's prefix", () => {
    window.localStorage.setItem("boholts-family-members", '["a","b"]');
    window.localStorage.setItem("boholts-family-calendar-events", "[]");
    window.localStorage.setItem("some-other-apps-key", "should not be included");

    const backup = createDataBackup();

    expect(backup.data).toEqual({
      "boholts-family-members": '["a","b"]',
      "boholts-family-calendar-events": "[]",
    });
    expect(backup.version).toBe(1);
    expect(typeof backup.exportedAt).toBe("string");
  });

  it("round-trips a backup back into localStorage", () => {
    window.localStorage.setItem("boholts-family-members", '["original"]');
    const backup = createDataBackup();

    window.localStorage.setItem("boholts-family-members", '["changed"]');
    restoreDataBackup(backup);

    expect(window.localStorage.getItem("boholts-family-members")).toBe('["original"]');
  });

  it("does not overwrite keys outside the app's prefix, even if present in the backup object", () => {
    restoreDataBackup({
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { "unrelated-key": "should not be written" },
    });

    expect(window.localStorage.getItem("unrelated-key")).toBeNull();
  });

  it("throws on an invalid backup shape instead of writing partial data", () => {
    expect(() => restoreDataBackup(null)).toThrow();
    expect(() => restoreDataBackup({})).toThrow();
    expect(() => restoreDataBackup({ version: 1, exportedAt: "x", data: { a: 1 } })).toThrow();
  });
});
