// @vitest-environment jsdom
import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarEventRange } from "../features/calendar/models/calendarProvider";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let capturedRange: CalendarEventRange | undefined;

vi.mock("../features/calendar/hooks/useCalendarEvents", () => ({
  useCalendarEvents: (_memberId: unknown, range: CalendarEventRange | undefined) => {
    capturedRange = range;
    return { events: [], isLoading: false, error: null };
  },
}));
vi.mock("../features/calendar/hooks/useCalendarSources", () => ({
  useCalendarSources: () => ({ visibleCalendarSourceIds: [] }),
}));
vi.mock("../features/calendar/hooks/useRecurrenceExceptions", () => ({
  useRecurrenceExceptions: () => ({ exceptions: [] }),
}));
vi.mock("../features/tasks/hooks/useTasks", () => ({
  useTasks: () => ({
    members: [],
    tasks: [],
    isLoading: false,
    error: null,
    toggleDone: vi.fn(),
    pendingOfflineChangeCount: 0,
  }),
}));
vi.mock("../features/family/hooks/useEnabledFeatures", () => ({
  useEnabledFeatures: () => ({ isEnabled: () => true, isLoading: false }),
}));
vi.mock("../features/family/familySessionCache", () => ({
  getCachedFamily: () => new Promise(() => undefined),
}));
vi.mock("../features/family/familyApi", async () => {
  const actual = await vi.importActual<typeof import("../features/family/familyApi")>(
    "../features/family/familyApi",
  );
  return { ...actual, getChildMessagesForMember: () => new Promise(() => undefined) };
});

afterEach(() => {
  vi.clearAllMocks();
  capturedRange = undefined;
  document.body.innerHTML = "";
});

// Sprint 57, afsnit D (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md):
// Mit i dag skal kun hente i dag ±1 dags buffer, ikke det brede "et år
// tilbage til to år frem"-standardinterval. Denne test dækker det
// faktiske interval, siden rent faktisk sender til useCalendarEvents.
describe("MitIDagPage's calendar fetch range", () => {
  it("henter kun i dag ±1 dags buffer, ikke et bredt standardinterval", async () => {
    const { default: MitIDagPage } = await import("./MitIDagPage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <MitIDagPage />
          </StrictMode>,
        );
      });

      expect(capturedRange).toBeDefined();
      const range = capturedRange!;
      const start = new Date(range.start);
      const end = new Date(range.end);

      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const expectedEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0);

      expect(start.getTime()).toBe(expectedStart.getTime());
      expect(end.getTime()).toBe(expectedEnd.getTime());

      // Ikke det tidligere brede "to år frem"-interval.
      const twoYearsFromNow = new Date(now);
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
      expect(end.getTime()).toBeLessThan(twoYearsFromNow.getTime());
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
