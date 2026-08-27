import { describe, expect, it } from "vitest";

import { formatDanishDateTime } from "./formatDanishDateTime";

describe("formatDanishDateTime", () => {
  // Testmiljøet er fastlåst til Europe/Copenhagen (se src/test/setupTimezone.ts)
  // — 20. august er sommertid (UTC+2), så 12:05 UTC bliver 14.05 lokalt.
  it("formats an ISO timestamp as day/month/year + hour:minute in local time", () => {
    expect(formatDanishDateTime("2026-08-20T12:05:00.000Z")).toBe("20.08.2026, 14.05");
  });
});
