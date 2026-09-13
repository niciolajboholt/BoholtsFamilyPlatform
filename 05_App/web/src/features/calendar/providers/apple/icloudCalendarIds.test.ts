import { describe, expect, it } from "vitest";

import { CalendarProviderError } from "../calendarProviderErrors";
import {
  decodeIcloudCalendarSourceId,
  decodeIcloudEventId,
  encodeIcloudCalendarSourceId,
  encodeIcloudEventId,
} from "./icloudCalendarIds";

describe("icloudCalendarIds", () => {
  it("round-trips a calendar source id, including a URL with special characters", () => {
    const calendarUrl = "https://p05-caldav.icloud.com/123456/calendars/home:work/";
    const sourceId = encodeIcloudCalendarSourceId("conn-1", calendarUrl);

    expect(decodeIcloudCalendarSourceId(sourceId)).toEqual({
      connectionId: "conn-1",
      calendarUrl,
    });
  });

  it("rejects a source id from a different provider", () => {
    expect(() => decodeIcloudCalendarSourceId("google:abc")).toThrow(CalendarProviderError);
  });

  it("round-trips an event id, including a null etag", () => {
    const calendarUrl = "https://p05-caldav.icloud.com/123456/calendars/home/";
    const href = `${calendarUrl}event1.ics`;
    const eventId = encodeIcloudEventId("conn-1", calendarUrl, "event1", href, null);

    expect(decodeIcloudEventId(eventId)).toEqual({
      connectionId: "conn-1",
      calendarUrl,
      uid: "event1",
      href,
      etag: null,
    });
  });

  it("round-trips an event id with a real etag containing quotes", () => {
    const calendarUrl = "https://p05-caldav.icloud.com/123456/calendars/home/";
    const href = `${calendarUrl}event1.ics`;
    const eventId = encodeIcloudEventId("conn-1", calendarUrl, "event1", href, '"abc123"');

    expect(decodeIcloudEventId(eventId).etag).toBe('"abc123"');
  });

  it("rejects an event id from a different provider", () => {
    expect(() => decodeIcloudEventId("ics-event:abc:def")).toThrow(CalendarProviderError);
  });
});
