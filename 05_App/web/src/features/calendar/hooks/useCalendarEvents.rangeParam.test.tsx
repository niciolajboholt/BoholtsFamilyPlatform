// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarEventRange } from "../models/calendarProvider";
import type { CalendarProvider } from "../providers/CalendarProvider";
import { useCalendarEvents } from "./useCalendarEvents";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function createProvider(getEvents: CalendarProvider["getEvents"]): CalendarProvider {
  return {
    getCalendars: async () => [],
    getEvents,
    createEvent: async () => {
      throw new Error("not used in this test");
    },
    updateEvent: async () => {
      throw new Error("not used in this test");
    },
    deleteEvent: async () => undefined,
    restoreEvent: async () => {
      throw new Error("not used in this test");
    },
  };
}

afterEach(() => {
  window.localStorage.clear();
});

// Sprint 57: Mit i dag/Overblik/kalenderens måned-/uge-/dagvisning skal
// hver kunne bede om et snævrere interval end det brede "et år tilbage
// til to år frem"-standardinterval, uden at det introducerer en
// uendelig genhentnings-løkke — se
// 57_Sprint57_Sammenhaeng_Hastighed_UX_Plan.md, afsnit D.
describe("useCalendarEvents range parameter", () => {
  it("uses the given range instead of the wide default", async () => {
    const requestedRanges: CalendarEventRange[] = [];
    const provider = createProvider(
      vi.fn(async (range: CalendarEventRange) => {
        requestedRanges.push(range);
        return [] as CalendarEvent[];
      }),
    );
    const narrowRange: CalendarEventRange = { start: "2026-07-29T00:00:00.000Z", end: "2026-07-30T00:00:00.000Z" };
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      useCalendarEvents(provider, narrowRange);
      return null;
    }

    await act(async () => {
      root.render(<StrictMode><Harness /></StrictMode>);
    });

    expect(requestedRanges.every((range) => range.start === narrowRange.start && range.end === narrowRange.end)).toBe(
      true,
    );

    await act(async () => root.unmount());
  });

  it("refetches when the range's start/end values actually change", async () => {
    const requestedRanges: CalendarEventRange[] = [];
    const provider = createProvider(
      vi.fn(async (range: CalendarEventRange) => {
        requestedRanges.push(range);
        return [] as CalendarEvent[];
      }),
    );
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      const [range, setRange] = useState<CalendarEventRange>({
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-07-08T00:00:00.000Z",
      });
      useCalendarEvents(provider, range);
      (window as unknown as { __setRange: typeof setRange }).__setRange = setRange;
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    const callsAfterMount = requestedRanges.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    await act(async () => {
      (window as unknown as { __setRange: (range: CalendarEventRange) => void }).__setRange({
        start: "2026-08-01T00:00:00.000Z",
        end: "2026-08-08T00:00:00.000Z",
      });
    });

    expect(requestedRanges.length).toBeGreaterThan(callsAfterMount);
    expect(requestedRanges.at(-1)).toEqual({ start: "2026-08-01T00:00:00.000Z", end: "2026-08-08T00:00:00.000Z" });

    await act(async () => root.unmount());
  });

  it("does NOT refetch when a new range object with the same start/end is passed in on re-render", async () => {
    const requestedRanges: CalendarEventRange[] = [];
    const provider = createProvider(
      vi.fn(async (range: CalendarEventRange) => {
        requestedRanges.push(range);
        return [] as CalendarEvent[];
      }),
    );
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness({ tick }: { tick: number }) {
      // Ny objektidentitet ved hvert render, men samme værdier — simulerer en
      // kalder, der (som HomePage/MitIDagPage) ikke selv memoiserer perfekt.
      void tick;
      useCalendarEvents(provider, { start: "2026-07-01T00:00:00.000Z", end: "2026-07-08T00:00:00.000Z" });
      return null;
    }

    await act(async () => {
      root.render(<Harness tick={0} />);
    });

    const callsAfterMount = requestedRanges.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    await act(async () => {
      root.render(<Harness tick={1} />);
    });

    expect(requestedRanges.length).toBe(callsAfterMount);

    await act(async () => root.unmount());
  });
});
