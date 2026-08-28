import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAndParseIcsCalendar, IcsFetchError, isBlockedIcsHost, parseIcsEvents } from "./icsCalendar";

const range = { start: "2026-08-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" };

describe("isBlockedIcsHost", () => {
  it.each([
    "localhost",
    "sub.localhost",
    "printer.local",
    "127.0.0.1",
    "127.5.5.5",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "[::1]",
    "[fe80::1]",
    "[fc00::1]",
    "[fd12::1]",
    "[::ffff:127.0.0.1]",
  ])("blocks %s", (hostname) => {
    expect(isBlockedIcsHost(hostname)).toBe(true);
  });

  it.each([
    "calendar.example.com",
    "www.google.com",
    "8.8.8.8",
    "172.32.0.1",
    "172.15.0.1",
    "1.1.1.1",
  ])("allows %s", (hostname) => {
    expect(isBlockedIcsHost(hostname)).toBe(false);
  });
});

describe("parseIcsEvents", () => {
  it("maps a simple event within range", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:event-1@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Bowling",
      "LOCATION:Bowlinghallen",
      "DESCRIPTION:Alle er velkomne",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics, range);

    expect(events).toEqual([
      {
        id: "event-1@example.com",
        title: "Bowling",
        description: "Alle er velkomne",
        location: "Bowlinghallen",
        isPrivate: false,
        allDay: false,
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T10:00:00.000Z",
      },
    ]);
  });

  it("redigerer et privat event til Optaget, uden beskrivelse/lokation", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:private-1@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Fortrolig behandling",
      "LOCATION:Klinik 4",
      "DESCRIPTION:Følsomme noter",
      "CLASS:PRIVATE",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics, range);

    expect(events[0]).toMatchObject({ title: "Optaget", description: undefined, location: undefined, isPrivate: true });
    expect(JSON.stringify(events)).not.toContain("Fortrolig behandling");
    expect(JSON.stringify(events)).not.toContain("Følsomme noter");
    expect(JSON.stringify(events)).not.toContain("Klinik 4");
  });

  it("skips a cancelled event", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:cancelled-1@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Aflyst",
      "STATUS:CANCELLED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcsEvents(ics, range)).toEqual([]);
  });

  it("expands a weekly recurring event and only keeps occurrences inside the range", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:weekly-1@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Ugentligt møde",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=20",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics, { start: "2026-09-05T00:00:00.000Z", end: "2026-09-20T00:00:00.000Z" });

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(new Date(event.start).getTime()).toBeGreaterThanOrEqual(new Date("2026-09-05T00:00:00.000Z").getTime());
      expect(new Date(event.start).getTime()).toBeLessThanOrEqual(new Date("2026-09-20T00:00:00.000Z").getTime());
    }
  });

  it("maps an all-day event", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:allday-1@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART;VALUE=DATE:20260905",
      "DTEND;VALUE=DATE:20260906",
      "SUMMARY:Ferie",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseIcsEvents(ics, range);
    expect(events[0]).toMatchObject({ allDay: true });
  });

  it("excludes an event entirely outside the range", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:far-away@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20270901T090000Z",
      "DTEND:20270901T100000Z",
      "SUMMARY:Langt ude i fremtiden",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcsEvents(ics, range)).toEqual([]);
  });

  it("throws IcsFetchError with code parse-error on invalid ICS text", () => {
    expect(() => parseIcsEvents("not an ics file", range)).toThrow(IcsFetchError);
  });
});

describe("fetchAndParseIcsCalendar", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a blocked host without ever calling fetch", async () => {
    await expect(
      fetchAndParseIcsCalendar("http://169.254.169.254/secret", range),
    ).rejects.toMatchObject({ code: "blocked-host" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) scheme without ever calling fetch", async () => {
    await expect(fetchAndParseIcsCalendar("file:///etc/passwd", range)).rejects.toMatchObject({
      code: "invalid-url",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and parses a valid feed", async () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:evt@example.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Test",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    fetchMock.mockResolvedValue(new Response(ics, { status: 200 }));

    const events = await fetchAndParseIcsCalendar("https://calendar.example.com/x.ics", range);
    expect(events).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect but revalidates the new host, rejecting one that points at a blocked host", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/internal" } }),
    );

    await expect(
      fetchAndParseIcsCalendar("https://calendar.example.com/x.ics", range),
    ).rejects.toMatchObject({ code: "blocked-host" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a non-2xx response as a network error", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(
      fetchAndParseIcsCalendar("https://calendar.example.com/x.ics", range),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("rejects a response over the size limit", async () => {
    const oversized = "A".repeat(3 * 1024 * 1024);
    fetchMock.mockResolvedValue(new Response(oversized, { status: 200 }));

    await expect(
      fetchAndParseIcsCalendar("https://calendar.example.com/x.ics", range),
    ).rejects.toMatchObject({ code: "too-large" });
  });
});
