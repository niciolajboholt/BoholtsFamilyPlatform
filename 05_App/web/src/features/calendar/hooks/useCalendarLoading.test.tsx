// @vitest-environment jsdom
import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import type { CalendarProvider } from "../providers/CalendarProvider";
import { useCalendarEvents } from "./useCalendarEvents";
import { useCalendarSources } from "./useCalendarSources";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const event: CalendarEvent = {
  id: "event-1",
  title: "Testaftale",
  start: "2026-07-29T17:00:00.000Z",
  end: "2026-07-29T18:00:00.000Z",
  allDay: false,
  ownerIds: ["family"],
  source: "internal",
  sourceId: "local:family",
};

const source: CalendarSource = {
  id: "local:family",
  name: "Familien",
  providerType: "local",
  color: "#6D597A",
  isVisible: true,
  isReadOnly: false,
  ownerId: "family",
};

function createProvider(
  overrides: Partial<CalendarProvider>,
): CalendarProvider {
  return {
    getCalendars: async () => [],
    getEvents: async () => [],
    createEvent: async () => event,
    updateEvent: async () => event,
    deleteEvent: async () => undefined,
    restoreEvent: async () => event,
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("calendar loading in Strict Mode", () => {
  it("lets the current event request finish after Strict Mode restarts the effect", async () => {
    const resolvers: Array<(events: CalendarEvent[]) => void> = [];
    const provider = createProvider({
      getEvents: vi.fn(() => new Promise<CalendarEvent[]>((resolve) => {
        resolvers.push(resolve);
      })),
    });
    let latestResult: ReturnType<typeof useCalendarEvents> | undefined;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      latestResult = useCalendarEvents(provider);
      return null;
    }

    await act(async () => {
      root.render(<StrictMode><Harness /></StrictMode>);
    });

    expect(provider.getEvents).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]([event]);
      await Promise.resolve();
    });

    expect(latestResult).toMatchObject({
      events: [event],
      hasLoadedEvents: true,
      isLoading: false,
      error: null,
    });

    await act(async () => root.unmount());
  });

  it("lets the current source request finish after Strict Mode restarts the effect", async () => {
    const resolvers: Array<(sources: CalendarSource[]) => void> = [];
    const provider = createProvider({
      getCalendars: vi.fn(() => new Promise<CalendarSource[]>((resolve) => {
        resolvers.push(resolve);
      })),
    });
    let latestResult: ReturnType<typeof useCalendarSources> | undefined;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      latestResult = useCalendarSources(provider);
      return null;
    }

    await act(async () => {
      root.render(<StrictMode><Harness /></StrictMode>);
    });

    expect(provider.getCalendars).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]([source]);
      await Promise.resolve();
    });

    expect(latestResult).toMatchObject({
      calendarSources: [source],
      visibleCalendarSourceIds: ["local:family"],
      hasLoadedSources: true,
      isLoading: false,
      error: null,
    });

    await act(async () => root.unmount());
  });
});
