import { describe, expect, it } from "vitest";

import type { IcloudCalendarEventDto, IcloudCalendarInfoDto } from "../../../family/familyApi";
import { mapIcloudCalendarEvent, mapIcloudCalendarSource } from "./icloudCalendarMapper";

const calendar: IcloudCalendarInfoDto = {
  url: "https://p05-caldav.icloud.com/123/calendars/home/",
  displayName: "Hjem",
  ctag: "abc",
};

const event: IcloudCalendarEventDto = {
  href: "https://p05-caldav.icloud.com/123/calendars/home/event1.ics",
  etag: '"1"',
  uid: "event1",
  title: "Tandlæge",
  start: "2026-10-01T10:00:00.000Z",
  end: "2026-10-01T10:30:00.000Z",
  allDay: false,
};

describe("mapIcloudCalendarSource", () => {
  it("marks the source as writable, unlike ICS", () => {
    const source = mapIcloudCalendarSource("conn-1", calendar);
    expect(source.isReadOnly).toBe(false);
    expect(source.providerType).toBe("apple");
  });

  it("uses the assigned member's name and color over the calendar's own display name", () => {
    const source = mapIcloudCalendarSource("conn-1", calendar, {
      id: "member-christine",
      name: "Christine",
      color: "#C06C84",
    });

    expect(source.name).toBe("Christine");
    expect(source.color).toBe("#C06C84");
  });

  it("falls back to the calendar's own display name when no member is assigned", () => {
    const source = mapIcloudCalendarSource("conn-1", calendar);
    expect(source.name).toBe("Hjem");
  });
});

describe("mapIcloudCalendarEvent", () => {
  it("marks the event source as apple and carries the assigned owner", () => {
    const mapped = mapIcloudCalendarEvent("conn-1", calendar.url, event, "member-christine");

    expect(mapped.source).toBe("apple");
    expect(mapped.ownerIds).toEqual(["member-christine"]);
    expect(mapped.title).toBe("Tandlæge");
  });

  it("leaves ownerIds empty when no member is assigned", () => {
    const mapped = mapIcloudCalendarEvent("conn-1", calendar.url, event, undefined);
    expect(mapped.ownerIds).toEqual([]);
  });

  it("encodes enough into the event id to round-trip a later update/delete", () => {
    const mapped = mapIcloudCalendarEvent("conn-1", calendar.url, event, undefined);
    expect(mapped.id).toContain("event1");
  });
});
