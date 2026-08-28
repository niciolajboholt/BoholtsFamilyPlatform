// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleCalendarEvent, GoogleCalendarListEntry } from "./googleCalendarTypes";
import type { GoogleCalendarEventsPage } from "./GoogleCalendarApi";
import {
  getCachedCalendarSyncState,
  OFFLINE_CACHE_MAX_AGE_MS,
} from "../../preferences/googleCalendarSyncCacheStorage";
import { CalendarProviderError } from "../calendarProviderErrors";

const listCalendars = vi.fn<() => Promise<GoogleCalendarListEntry[]>>();
const listEvents = vi.fn<
  (
    calendarId: string,
    params: { range: { start: string; end: string } } | { syncToken: string },
  ) => Promise<GoogleCalendarEventsPage>
>();

vi.mock("./GoogleCalendarApi", () => ({
  GoogleCalendarApi: vi.fn().mockImplementation(function (this: {
    listCalendars: typeof listCalendars;
    listEvents: typeof listEvents;
  }) {
    this.listCalendars = listCalendars;
    this.listEvents = listEvents;
  }),
}));

vi.mock("../../preferences/calendarMemberMappingStorage", () => ({
  refreshCalendarMemberMappingsFromServer: vi.fn().mockResolvedValue(undefined),
  getCalendarMemberMappings: vi.fn().mockReturnValue({}),
  getMappedOwnersByCalendarId: vi.fn().mockReturnValue(new Map()),
}));

vi.mock("../../preferences/googleCalendarExclusionStorage", () => ({
  getExcludedGoogleCalendarIds: vi.fn().mockReturnValue([]),
}));

vi.mock("../../preferences/familyMembersStorage", () => ({
  getFamilyMembers: vi.fn().mockReturnValue([]),
}));

const range = { start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T00:00:00.000Z" };
const calendarId = "cal-1";

function googleEvent(overrides: Partial<GoogleCalendarEvent> = {}): GoogleCalendarEvent {
  return {
    id: "evt-1",
    summary: "Tandlæge",
    start: { dateTime: "2026-08-20T10:00:00.000Z" },
    end: { dateTime: "2026-08-20T10:30:00.000Z" },
    ...overrides,
  };
}

describe("GoogleCalendarProvider.getEvents (Sprint 25: inkrementel synk)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    listCalendars.mockResolvedValue([{ id: calendarId, summary: "Familien" }]);
  });

  async function createProvider() {
    const { GoogleCalendarProvider } = await import("./GoogleCalendarProvider");
    return new GoogleCalendarProvider();
  }

  it("laver en fuld synk, når intet er cachet, og gemmer det returnerede syncToken", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent()],
      nextSyncToken: "token-1",
    });

    const provider = await createProvider();
    const events = await provider.getEvents(range);

    expect(listEvents).toHaveBeenCalledWith(calendarId, { range });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Tandlæge");
    expect(getCachedCalendarSyncState(calendarId)?.syncToken).toBe("token-1");
  });

  it("bruger et cachet syncToken i stedet for tidsvinduet på næste kald", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent()],
      nextSyncToken: "token-1",
    });
    const provider = await createProvider();
    await provider.getEvents(range);

    listEvents.mockResolvedValue({ events: [], nextSyncToken: "token-2" });
    await provider.getEvents(range);

    expect(listEvents).toHaveBeenLastCalledWith(calendarId, { syncToken: "token-1" });
  });

  it("flet en ændret aftale ind i den cachede liste uden at miste andre", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1" }), googleEvent({ id: "evt-2", summary: "Fødselsdag" })],
      nextSyncToken: "token-1",
    });
    const provider = await createProvider();
    await provider.getEvents(range);

    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1", summary: "Tandlæge (flyttet)" })],
      nextSyncToken: "token-2",
    });
    const events = await provider.getEvents(range);

    expect(events).toHaveLength(2);
    expect(events.find((event) => event.title === "Tandlæge (flyttet)")).toBeDefined();
    expect(events.find((event) => event.title === "Fødselsdag")).toBeDefined();
  });

  it("fjerner en aflyst aftale fra den cachede liste (status: cancelled)", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1" })],
      nextSyncToken: "token-1",
    });
    const provider = await createProvider();
    await provider.getEvents(range);

    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1", status: "cancelled" })],
      nextSyncToken: "token-2",
    });
    const events = await provider.getEvents(range);

    expect(events).toHaveLength(0);
  });

  it("falder tilbage til en fuld synk, når syncToken er udløbet (410 -> not-found)", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1" })],
      nextSyncToken: "token-1",
    });
    const provider = await createProvider();
    await provider.getEvents(range);

    listEvents.mockRejectedValueOnce(
      new CalendarProviderError("not-found", "syncToken udløbet"),
    );
    listEvents.mockResolvedValueOnce({
      events: [googleEvent({ id: "evt-1", summary: "Genindlæst efter fuld synk" })],
      nextSyncToken: "token-3",
    });

    const events = await provider.getEvents(range);

    expect(listEvents).toHaveBeenLastCalledWith(calendarId, { range });
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Genindlæst efter fuld synk");
    expect(getCachedCalendarSyncState(calendarId)?.syncToken).toBe("token-3");
  });

  it("kaster videre fejl der hverken er syncToken-udløb eller en netværksfejl", async () => {
    listEvents.mockResolvedValue({
      events: [googleEvent({ id: "evt-1" })],
      nextSyncToken: "token-1",
    });
    const provider = await createProvider();
    await provider.getEvents(range);

    listEvents.mockRejectedValueOnce(new CalendarProviderError("authentication", "udløbet login"));

    await expect(provider.getEvents(range)).rejects.toThrow("udløbet login");
  });

  describe("Fase 8: offline-fallback ved netværksfejl", () => {
    it("falder tilbage til den friske cache i stedet for at kaste fejlen videre", async () => {
      listEvents.mockResolvedValue({
        events: [googleEvent({ id: "evt-1" })],
        nextSyncToken: "token-1",
      });
      const provider = await createProvider();
      await provider.getEvents(range);

      listEvents.mockRejectedValueOnce(new CalendarProviderError("network", "netværksfejl"));

      const events = await provider.getEvents(range);

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Tandlæge");
      expect(provider.getOfflineCacheAsOf()).not.toBeNull();
    });

    it("returnerer null fra getOfflineCacheAsOf() efter en normal, vellykket hentning", async () => {
      listEvents.mockResolvedValue({
        events: [googleEvent({ id: "evt-1" })],
        nextSyncToken: "token-1",
      });
      const provider = await createProvider();
      await provider.getEvents(range);

      expect(provider.getOfflineCacheAsOf()).toBeNull();
    });

    it("kaster netværksfejlen videre, hvis intet er cachet endnu", async () => {
      const provider = await createProvider();
      listCalendars.mockRejectedValueOnce(new CalendarProviderError("network", "netværksfejl"));

      await expect(provider.getEvents(range)).rejects.toThrow("netværksfejl");
    });

    it("kaster netværksfejlen videre, hvis den eneste cache er ældre end 7-dages-TTL'en", async () => {
      listEvents.mockResolvedValue({
        events: [googleEvent({ id: "evt-1" })],
        nextSyncToken: "token-1",
      });
      const provider = await createProvider();
      await provider.getEvents(range);

      const staleTime = Date.now() + OFFLINE_CACHE_MAX_AGE_MS + 1000;
      vi.useFakeTimers();
      vi.setSystemTime(staleTime);

      listEvents.mockRejectedValueOnce(new CalendarProviderError("network", "netværksfejl"));

      await expect(provider.getEvents(range)).rejects.toThrow("netværksfejl");

      vi.useRealTimers();
    });
  });
});
