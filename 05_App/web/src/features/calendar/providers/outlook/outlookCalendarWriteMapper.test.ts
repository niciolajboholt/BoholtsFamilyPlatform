import { describe, expect, it } from "vitest";

import type { CreateCalendarEventInput } from "../../models/calendarEventInput";
import { mapOutlookEventWriteRequest } from "./outlookCalendarWriteMapper";

describe("mapOutlookEventWriteRequest", () => {
  const baseInput: CreateCalendarEventInput = {
    title: "Test",
    start: "2026-07-31T09:00:00+02:00",
    end: "2026-07-31T10:00:00+02:00",
    allDay: false,
    ownerIds: [],
    sourceId: "outlook:calendar",
  };

  it("writes and clears Outlook sensitivity explicitly", () => {
    expect(
      mapOutlookEventWriteRequest({ ...baseInput, privacy: "busy" }).sensitivity,
    ).toBe("private");
    expect(mapOutlookEventWriteRequest(baseInput).sensitivity).toBe("normal");
  });
});
