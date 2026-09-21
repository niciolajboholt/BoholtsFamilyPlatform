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
vi.mock("../features/calendar/hooks/useCurrentMember", () => ({
  useCurrentMember: () => ({ currentMember: null }),
}));
vi.mock("../features/calendar/hooks/useFamilyMembers", () => ({
  useFamilyMembers: () => ({ members: [] }),
}));
vi.mock("../features/calendar/hooks/useRecurrenceExceptions", () => ({
  useRecurrenceExceptions: () => ({ exceptions: [] }),
}));
vi.mock("../features/family/hooks/useEnabledFeatures", () => ({
  useEnabledFeatures: () => ({ isEnabled: () => true, isLoading: false }),
}));
vi.mock("../features/activity/ActivityCard", () => ({
  ActivityCard: () => null,
}));
vi.mock("../features/family/WeeklySummaryCard", () => ({
  WeeklySummaryCard: () => null,
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

afterEach(() => {
  vi.clearAllMocks();
  capturedRange = undefined;
  document.body.innerHTML = "";
});

// Sprint 57, afsnit D (se 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md):
// Forsiden skal kun hente i dag + "Næste aftale"'s 14-dages
// udkigsvindue (dashboardLookaheadDays i HomePage.tsx), ikke det brede
// "et år tilbage til to år frem"-standardinterval. Denne test dækker det
// faktiske interval, HomePage rent faktisk sender til useCalendarEvents.
describe("HomePage's calendar fetch range", () => {
  it("henter fra nu og 14 dage frem, ikke et bredt standardinterval", async () => {
    const before = new Date();

    const { default: HomePage } = await import("./HomePage");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <StrictMode>
            <HomePage />
          </StrictMode>,
        );
      });

      const after = new Date();

      expect(capturedRange).toBeDefined();
      const range = capturedRange!;
      const start = new Date(range.start);
      const end = new Date(range.end);

      // Startet er "nu" ved mount — inden for testens egen udførselsvindue.
      expect(start.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(start.getTime()).toBeLessThanOrEqual(after.getTime());

      // Slut er nøjagtig 14 dage efter start (dashboardLookaheadDays).
      const expectedEnd = new Date(start);
      expectedEnd.setDate(expectedEnd.getDate() + 14);
      expect(end.getTime()).toBe(expectedEnd.getTime());

      // Ikke det tidligere brede "et år tilbage"-interval.
      const oneYearAgo = new Date(before);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      expect(start.getTime()).toBeGreaterThan(oneYearAgo.getTime());
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
