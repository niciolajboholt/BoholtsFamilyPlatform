// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { CreateCalendarEventInput } from "../models/calendarEventInput";
import { CalendarService } from "./CalendarService";

const baseEvent: Omit<CreateCalendarEventInput, "title" | "ownerIds" | "sourceId"> = {
  start: "2026-07-29T17:00:00.000Z",
  end: "2026-07-29T18:00:00.000Z",
  allDay: false,
};

describe("CalendarService.reassignOwner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("moves local owners and their source atomically to the family calendar", async () => {
    const movedEvent = await CalendarService.createEvent({
      ...baseEvent,
      title: "Flyttes",
      ownerIds: ["nicolaj", "family"],
      sourceId: "local:nicolaj",
    });
    const unaffectedEvent = await CalendarService.createEvent({
      ...baseEvent,
      title: "Forbliver",
      ownerIds: ["christine"],
      sourceId: "local:christine",
    });

    await CalendarService.reassignOwner("nicolaj", "family");

    const reloadedEvents = await CalendarService.getEvents();
    const reloadedMovedEvent = reloadedEvents.find(
      (event) => event.id === movedEvent.id,
    );
    const reloadedUnaffectedEvent = reloadedEvents.find(
      (event) => event.id === unaffectedEvent.id,
    );

    expect(reloadedMovedEvent).toMatchObject({
      ownerIds: ["family"],
      sourceId: "local:family",
    });
    expect(reloadedUnaffectedEvent).toMatchObject({
      ownerIds: ["christine"],
      sourceId: "local:christine",
    });
  });

  it("does not rewrite a non-local source id", async () => {
    const event = await CalendarService.createEvent({
      ...baseEvent,
      title: "Google-kilde",
      ownerIds: ["nicolaj"],
      sourceId: "google:primary",
    });

    await CalendarService.reassignOwner("nicolaj", "family");

    const reloadedEvent = (await CalendarService.getEvents()).find(
      (currentEvent) => currentEvent.id === event.id,
    );

    expect(reloadedEvent).toMatchObject({
      ownerIds: ["family"],
      sourceId: "google:primary",
    });
  });
});
