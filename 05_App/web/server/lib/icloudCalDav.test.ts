import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteEvent,
  discoverCalendars,
  fetchCalendarEvents,
  ICloudCalDavError,
  putEvent,
} from "./icloudCalDav";

const credentials = { appleIdEmail: "nicolaj@icloud.com", appSpecificPassword: "abcd-efgh-ijkl-mnop" };

function xmlResponse(body: string, status = 207, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8", ...headers },
  });
}

describe("discoverCalendars", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("følger principal → calendar-home-set → kalenderliste, på tværs af navnerum-præfikser", async () => {
    fetchMock
      .mockResolvedValueOnce(
        xmlResponse(
          '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">' +
            "<d:response><d:href>/12345/principal/</d:href>" +
            "<d:propstat><d:status>HTTP/1.1 200 OK</d:status><d:prop>" +
            '<d:current-user-principal><d:href>/12345/principal/</d:href></d:current-user-principal>' +
            "</d:prop></d:propstat></d:response></d:multistatus>",
        ),
      )
      .mockResolvedValueOnce(
        xmlResponse(
          '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
            "<response><href>/12345/principal/</href>" +
            "<propstat><status>HTTP/1.1 200 OK</status><prop>" +
            "<c:calendar-home-set><href>/12345/calendars/</href></c:calendar-home-set>" +
            "</prop></propstat></response></multistatus>",
        ),
      )
      .mockResolvedValueOnce(
        xmlResponse(
          '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:cs="http://calendarserver.org/ns/">' +
            "<response><href>/12345/calendars/home/</href>" +
            "<propstat><status>HTTP/1.1 200 OK</status><prop>" +
            "<resourcetype><collection/><calendar/></resourcetype>" +
            "<displayname>Familie</displayname><cs:getctag>ctag-1</cs:getctag>" +
            "</prop></propstat></response>" +
            "<response><href>/12345/calendars/tasks/</href>" +
            "<propstat><status>HTTP/1.1 200 OK</status><prop>" +
            "<resourcetype><collection/></resourcetype>" +
            "<displayname>Opgaver (ikke en kalender)</displayname>" +
            "</prop></propstat></response></multistatus>",
        ),
      );

    const calendars = await discoverCalendars(credentials);

    expect(calendars).toEqual([
      { url: "https://caldav.icloud.com/12345/calendars/home/", displayName: "Familie", ctag: "ctag-1" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("https://caldav.icloud.com/");
    expect(fetchMock.mock.calls[1][0]).toBe("https://caldav.icloud.com/12345/principal/");
    expect(fetchMock.mock.calls[2][0]).toBe("https://caldav.icloud.com/12345/calendars/");
  });

  it("følger en 301-omdirigering til kontoens region-specifikke server", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: "https://p42-caldav.icloud.com/" },
        }),
      )
      .mockResolvedValueOnce(
        xmlResponse(
          '<?xml version="1.0"?><multistatus xmlns="DAV:">' +
            "<response><href>/12345/principal/</href>" +
            "<propstat><status>HTTP/1.1 200 OK</status><prop>" +
            "<current-user-principal><href>/12345/principal/</href></current-user-principal>" +
            "</prop></propstat></response></multistatus>",
        ),
      )
      .mockResolvedValueOnce(
        xmlResponse(
          '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
            "<response><href>/12345/principal/</href>" +
            "<propstat><status>HTTP/1.1 200 OK</status><prop>" +
            "<c:calendar-home-set><href>/12345/calendars/</href></c:calendar-home-set>" +
            "</prop></propstat></response></multistatus>",
        ),
      )
      .mockResolvedValueOnce(xmlResponse('<?xml version="1.0"?><multistatus xmlns="DAV:"></multistatus>'));

    const calendars = await discoverCalendars(credentials);

    expect(calendars).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toBe("https://p42-caldav.icloud.com/");
  });

  it("kaster invalid-credentials ved en 401", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(discoverCalendars(credentials)).rejects.toMatchObject({
      code: "invalid-credentials",
    } satisfies Partial<ICloudCalDavError>);
  });
});

describe("fetchCalendarEvents", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parser hændelser ud af calendar-data i et REPORT-svar", async () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:event-1@icloud.com",
      "DTSTAMP:20260101T000000Z",
      "DTSTART:20260901T090000Z",
      "DTEND:20260901T100000Z",
      "SUMMARY:Håndbold",
      "LOCATION:Hallen",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    fetchMock.mockResolvedValueOnce(
      xmlResponse(
        '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
          "<response><href>/12345/calendars/home/event-1.ics</href>" +
          '<propstat><status>HTTP/1.1 200 OK</status><prop>' +
          '<getetag>"abc123"</getetag>' +
          `<c:calendar-data>${ics.replace(/</g, "&lt;")}</c:calendar-data>` +
          "</prop></propstat></response></multistatus>",
      ),
    );

    const events = await fetchCalendarEvents(
      "https://p42-caldav.icloud.com/12345/calendars/home/",
      credentials,
      { start: "2026-08-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" },
    );

    expect(events).toEqual([
      {
        href: "https://p42-caldav.icloud.com/12345/calendars/home/event-1.ics",
        etag: '"abc123"',
        uid: "event-1@icloud.com",
        title: "Håndbold",
        start: "2026-09-01T09:00:00.000Z",
        end: "2026-09-01T10:00:00.000Z",
        allDay: false,
        location: "Hallen",
      },
    ]);
  });

  it("springer en ulæselig calendar-data-blok over uden at fejle hele kaldet", async () => {
    fetchMock.mockResolvedValueOnce(
      xmlResponse(
        '<?xml version="1.0"?><multistatus xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
          "<response><href>/12345/calendars/home/broken.ics</href>" +
          '<propstat><status>HTTP/1.1 200 OK</status><prop>' +
          '<getetag>"x"</getetag><c:calendar-data>not-valid-icalendar</c:calendar-data>' +
          "</prop></propstat></response></multistatus>",
      ),
    );

    const events = await fetchCalendarEvents(
      "https://p42-caldav.icloud.com/12345/calendars/home/",
      credentials,
      { start: "2026-08-01T00:00:00.000Z", end: "2026-10-01T00:00:00.000Z" },
    );

    expect(events).toEqual([]);
  });
});

describe("putEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opretter en ny hændelse med If-None-Match: * og returnerer det nye etag", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201, headers: { ETag: '"new-etag"' } }));

    const result = await putEvent(
      "https://p42-caldav.icloud.com/12345/calendars/home/",
      { uid: "new-event", title: "Tandlæge", start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T09:30:00.000Z" },
      credentials,
      null,
    );

    expect(result).toEqual({
      href: "https://p42-caldav.icloud.com/12345/calendars/home/new-event.ics",
      etag: '"new-etag"',
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.method).toBe("PUT");
    expect(requestInit.headers["If-None-Match"]).toBe("*");
    expect(requestInit.headers["If-Match"]).toBeUndefined();
    expect(requestInit.body).toContain("SUMMARY:Tandlæge");
  });

  it("sender If-Match ved opdatering af en eksisterende hændelse", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204, headers: { ETag: '"updated-etag"' } }));

    await putEvent(
      "https://p42-caldav.icloud.com/12345/calendars/home/",
      { uid: "existing-event", title: "Flyttet", start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T09:30:00.000Z" },
      credentials,
      '"old-etag"',
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.headers["If-Match"]).toBe('"old-etag"');
  });

  it("kaster conflict ved 412 Precondition Failed", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 412 }));

    await expect(
      putEvent(
        "https://p42-caldav.icloud.com/12345/calendars/home/",
        { uid: "existing-event", title: "X", start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T09:30:00.000Z" },
        credentials,
        '"old-etag"',
      ),
    ).rejects.toMatchObject({ code: "conflict" } satisfies Partial<ICloudCalDavError>);
  });
});

describe("deleteEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sletter med If-Match og accepterer 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      deleteEvent("https://p42-caldav.icloud.com/12345/calendars/home/x.ics", credentials, '"etag"'),
    ).resolves.toBeUndefined();

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.method).toBe("DELETE");
    expect(requestInit.headers["If-Match"]).toBe('"etag"');
  });

  it("kaster conflict ved 412 Precondition Failed", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 412 }));

    await expect(
      deleteEvent("https://p42-caldav.icloud.com/12345/calendars/home/x.ics", credentials, '"etag"'),
    ).rejects.toMatchObject({ code: "conflict" } satisfies Partial<ICloudCalDavError>);
  });
});
