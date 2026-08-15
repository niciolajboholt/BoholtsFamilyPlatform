import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../models/calendarEvent";
import type { CalendarSource } from "../models/calendarProvider";
import type { CalendarProvider } from "./CalendarProvider";
import { CalendarProviderError } from "./calendarProviderErrors";
import { CompositeCalendarProvider } from "./CompositeCalendarProvider";

function notImplemented(): never {
  throw new Error("not implemented in this fake");
}

function fakeSource(id: string): CalendarSource {
  return {
    id,
    name: id,
    providerType: "google",
    color: "#000000",
    isVisible: true,
    isReadOnly: false,
  };
}

function fakeEvent(id: string): CalendarEvent {
  return {
    id,
    title: id,
    start: "2026-07-31T09:00:00Z",
    end: "2026-07-31T10:00:00Z",
    allDay: false,
    ownerIds: ["family"],
    source: "internal",
  };
}

function succeedingProvider(sources: CalendarSource[], events: CalendarEvent[]): CalendarProvider {
  return {
    getCalendars: () => Promise.resolve(sources),
    getEvents: () => Promise.resolve(events),
    createEvent: notImplemented,
    updateEvent: notImplemented,
    deleteEvent: notImplemented,
    restoreEvent: notImplemented,
  };
}

function failingProvider(): CalendarProvider {
  return {
    getCalendars: () => Promise.reject(new CalendarProviderError("network", "kaputt")),
    getEvents: () => Promise.reject(new CalendarProviderError("network", "kaputt")),
    createEvent: notImplemented,
    updateEvent: notImplemented,
    deleteEvent: notImplemented,
    restoreEvent: notImplemented,
  };
}

describe("CompositeCalendarProvider", () => {
  it("returns nothing when there are no external providers, without throwing", async () => {
    const composite = new CompositeCalendarProvider({ external: [] });

    expect(await composite.getCalendars()).toEqual([]);
    expect(await composite.getEvents({ start: "", end: "" })).toEqual([]);
  });

  it("merges data from multiple succeeding external providers", async () => {
    const google = succeedingProvider(
      [fakeSource("google:primary")],
      [fakeEvent("google-event")],
    );
    const outlook = succeedingProvider(
      [fakeSource("outlook:primary")],
      [fakeEvent("outlook-event")],
    );
    const composite = new CompositeCalendarProvider({
      external: [
        { providerId: "google", provider: google, sourceIdPrefix: "google:" },
        { providerId: "outlook", provider: outlook, sourceIdPrefix: "outlook:" },
      ],
    });

    const calendars = await composite.getCalendars();
    expect(calendars).toContainEqual(fakeSource("google:primary"));
    expect(calendars).toContainEqual(fakeSource("outlook:primary"));

    const events = await composite.getEvents({ start: "", end: "" });
    expect(events).toContainEqual(fakeEvent("google-event"));
    expect(events).toContainEqual(fakeEvent("outlook-event"));
  });

  it("isolates a failing provider from a succeeding one, without throwing", async () => {
    const outlook = succeedingProvider(
      [fakeSource("outlook:primary")],
      [fakeEvent("outlook-event")],
    );
    const composite = new CompositeCalendarProvider({
      external: [
        { providerId: "google", provider: failingProvider(), sourceIdPrefix: "google:" },
        { providerId: "outlook", provider: outlook, sourceIdPrefix: "outlook:" },
      ],
    });

    const calendars = await composite.getCalendars();
    expect(calendars).toEqual([fakeSource("outlook:primary")]);

    const googleHealth = composite.getProviderHealth().find((entry) => entry.providerId === "google");
    const outlookHealth = composite.getProviderHealth().find((entry) => entry.providerId === "outlook");
    expect(googleHealth?.status).toBe("error");
    expect(outlookHealth?.status).toBe("ready");
  });

  it("marks a provider as disconnected on an authentication error, not a generic error", async () => {
    const authFailure: CalendarProvider = {
      getCalendars: () => Promise.reject(new CalendarProviderError("authentication", "ikke forbundet")),
      getEvents: () => Promise.reject(new CalendarProviderError("authentication", "ikke forbundet")),
      createEvent: notImplemented,
      updateEvent: notImplemented,
      deleteEvent: notImplemented,
      restoreEvent: notImplemented,
    };
    const composite = new CompositeCalendarProvider({
      external: [{ providerId: "google", provider: authFailure, sourceIdPrefix: "google:" }],
    });

    await composite.getCalendars();

    const health = composite.getProviderHealth().find((entry) => entry.providerId === "google");
    expect(health?.status).toBe("disconnected");
  });

  it("routes createEvent/updateEvent/deleteEvent to the matching provider by sourceId prefix", async () => {
    let createdOnGoogle = false;
    const google: CalendarProvider = {
      getCalendars: () => Promise.resolve([]),
      getEvents: () => Promise.resolve([]),
      createEvent: (input) => {
        createdOnGoogle = true;
        return Promise.resolve(fakeEvent(input.title));
      },
      updateEvent: notImplemented,
      deleteEvent: notImplemented,
      restoreEvent: notImplemented,
    };
    const composite = new CompositeCalendarProvider({
      external: [{ providerId: "google", provider: google, sourceIdPrefix: "google:" }],
    });

    await composite.createEvent({
      title: "Ny aftale",
      start: "2026-07-31T09:00:00Z",
      end: "2026-07-31T10:00:00Z",
      allDay: false,
      ownerIds: [],
      sourceId: "google:primary",
    });

    expect(createdOnGoogle).toBe(true);
  });

  it("throws not-found for an unknown or missing sourceId", () => {
    const composite = new CompositeCalendarProvider({ external: [] });

    // getProviderForSource throws synchronously, before a Promise even
    // exists to reject — mirrors the pre-existing behaviour of the class.
    expect(() =>
      composite.deleteEvent("some-id", "unknown-provider:123"),
    ).toThrow(CalendarProviderError);
    expect(() => composite.deleteEvent("some-id", undefined)).toThrow(
      CalendarProviderError,
    );
  });
});
