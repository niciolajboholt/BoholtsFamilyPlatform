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
    providerType: "local",
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
  const localProvider = succeedingProvider(
    [fakeSource("local:family")],
    [fakeEvent("local-event")],
  );

  it("returns only local data when there are no external providers", async () => {
    const composite = new CompositeCalendarProvider({ local: localProvider, external: [] });

    expect(await composite.getCalendars()).toEqual([fakeSource("local:family")]);
    expect(await composite.getEvents({ start: "", end: "" })).toEqual([
      fakeEvent("local-event"),
    ]);
  });

  it("merges local data with a succeeding external provider", async () => {
    const google = succeedingProvider(
      [fakeSource("google:primary")],
      [fakeEvent("google-event")],
    );
    const composite = new CompositeCalendarProvider({
      local: localProvider,
      external: [{ providerId: "google", provider: google, sourceIdPrefix: "google:" }],
    });

    const calendars = await composite.getCalendars();
    expect(calendars).toContainEqual(fakeSource("local:family"));
    expect(calendars).toContainEqual(fakeSource("google:primary"));

    const events = await composite.getEvents({ start: "", end: "" });
    expect(events).toContainEqual(fakeEvent("local-event"));
    expect(events).toContainEqual(fakeEvent("google-event"));
  });

  it("keeps local data when one external provider fails, without throwing", async () => {
    const composite = new CompositeCalendarProvider({
      local: localProvider,
      external: [{ providerId: "google", provider: failingProvider(), sourceIdPrefix: "google:" }],
    });

    expect(await composite.getCalendars()).toEqual([fakeSource("local:family")]);
    expect(await composite.getEvents({ start: "", end: "" })).toEqual([
      fakeEvent("local-event"),
    ]);

    const health = composite.getProviderHealth().find((entry) => entry.providerId === "google");
    expect(health?.status).toBe("error");
  });

  it("isolates a failing provider from a succeeding one when both are configured", async () => {
    const outlook = succeedingProvider(
      [fakeSource("outlook:primary")],
      [fakeEvent("outlook-event")],
    );
    const composite = new CompositeCalendarProvider({
      local: localProvider,
      external: [
        { providerId: "google", provider: failingProvider(), sourceIdPrefix: "google:" },
        { providerId: "outlook", provider: outlook, sourceIdPrefix: "outlook:" },
      ],
    });

    const calendars = await composite.getCalendars();
    expect(calendars).toContainEqual(fakeSource("local:family"));
    expect(calendars).toContainEqual(fakeSource("outlook:primary"));
    expect(calendars.some((source) => source.id.startsWith("google:"))).toBe(false);

    const googleHealth = composite.getProviderHealth().find((entry) => entry.providerId === "google");
    const outlookHealth = composite.getProviderHealth().find((entry) => entry.providerId === "outlook");
    expect(googleHealth?.status).toBe("error");
    expect(outlookHealth?.status).toBe("ready");
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
      local: localProvider,
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

  it("throws not-found for an unknown sourceId prefix", () => {
    const composite = new CompositeCalendarProvider({ local: localProvider, external: [] });

    // getProviderForSource throws synchronously, before a Promise even
    // exists to reject — mirrors the pre-existing behaviour of the class.
    expect(() =>
      composite.deleteEvent("some-id", "unknown-provider:123"),
    ).toThrow(CalendarProviderError);
  });
});
