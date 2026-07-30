import { describe, expect, it } from "vitest";

import {
  decodeGoogleCalendarSourceId,
  decodeGoogleEventId,
  encodeGoogleCalendarSourceId,
  encodeGoogleEventId,
} from "./googleCalendarIds";
import { CalendarProviderError } from "../calendarProviderErrors";

describe("googleCalendarIds", () => {
  it("round-trips a calendar source id", () => {
    const sourceId = encodeGoogleCalendarSourceId(
      "nicolaj@example.com",
    );

    expect(decodeGoogleCalendarSourceId(sourceId)).toBe(
      "nicolaj@example.com",
    );
  });

  it("rejects a source id that is not a Google source", () => {
    expect(() =>
      decodeGoogleCalendarSourceId("local:family"),
    ).toThrow(CalendarProviderError);
  });

  it("round-trips an event id, including calendar ids containing colons", () => {
    const eventId = encodeGoogleEventId(
      "nicolaj@example.com",
      "abc:123",
    );

    expect(decodeGoogleEventId(eventId)).toEqual({
      calendarId: "nicolaj@example.com",
      eventId: "abc:123",
    });
  });

  it("rejects an event id that is not a Google event", () => {
    expect(() => decodeGoogleEventId("local-event:1")).toThrow(
      CalendarProviderError,
    );
  });

  it("rejects a malformed Google event id", () => {
    expect(() =>
      decodeGoogleEventId("google-event:onlyOnePart"),
    ).toThrow(CalendarProviderError);
  });
});
