import ICAL from "ical.js";
import { XMLParser } from "fast-xml-parser";

// Sprint 47 (se 47_Sprint47_iCloud_Kalender_CalDAV_Plan.md): iCloud-kalender
// via CalDAV — en åben WebDAV-baseret protokol (RFC 4791), ikke en
// almindelig REST-API. I modsætning til Google er der intet OAuth: brugeren
// autentificerer med en Apple "app-specifik adgangskode" via HTTP Basic
// Auth. I modsætning til ICS-abonnementer (server/lib/icsCalendar.ts) er
// URL'en her IKKE bruger-angivet (altid caldav.icloud.com), så SSRF er ikke
// en relevant trussel her — men Apple sharder konti på tværs af regionale
// servere, så det indledende kald omdirigerer typisk videre til en
// konto-specifik host (fx pNN-caldav.icloud.com), som følges manuelt,
// samme mønster som icsCalendar.ts's redirect-håndtering.
//
// ical.js bruges både til at parse hændelser ud af CalDAV-svarenes
// iCalendar-data OG til at bygge iCalendar-dokumenter ved skrivning (PUT) —
// samme bibliotek, appen allerede bruger til ICS-abonnementer.
//
// IKKE afprøvet mod en rigtig iCloud-konto endnu: implementeringen følger
// CalDAV-specifikationen og dokumenteret praksis fra andre
// tredjeparts-CalDAV-klienter, men kræver reel test med et Apple-ID og en
// app-specifik adgangskode (kun Nicolaj kan generere den), før den kan
// regnes for bekræftet korrekt mod iCloud i praksis.

const caldavBaseUrl = "https://caldav.icloud.com";
const requestTimeoutMs = 10_000;
const maxResponseBytes = 5 * 1024 * 1024;
const maxRedirects = 5;

export type ICloudCalDavErrorCode =
  | "invalid-credentials"
  | "network"
  | "timeout"
  | "too-large"
  | "parse-error"
  | "not-found"
  | "conflict";

export class ICloudCalDavError extends Error {
  code: ICloudCalDavErrorCode;

  constructor(message: string, code: ICloudCalDavErrorCode) {
    super(message);
    this.code = code;
    this.name = "ICloudCalDavError";
  }
}

export interface ICloudCredentials {
  appleIdEmail: string;
  appSpecificPassword: string;
}

export interface ICloudCalendarInfo {
  url: string;
  displayName: string;
  ctag: string | null;
}

export interface ICloudCalendarEvent {
  href: string;
  etag: string | null;
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
}

export interface ICloudEventInput {
  uid: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

const xmlParser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  trimValues: true,
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function basicAuthHeader(credentials: ICloudCredentials): string {
  return `Basic ${btoa(`${credentials.appleIdEmail}:${credentials.appSpecificPassword}`)}`;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return await response.text();
  }

  const decoder = new TextDecoder();
  let result = "";
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new ICloudCalDavError("iCloud-svaret var for stort.", "too-large");
    }

    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();
  return result;
}

interface DavRequestInit {
  method: "PROPFIND" | "REPORT" | "PUT" | "DELETE";
  credentials: ICloudCredentials;
  body?: string;
  depth?: "0" | "1";
  extraHeaders?: Record<string, string>;
}

interface DavResponse {
  status: number;
  headers: Headers;
  text: string;
  finalUrl: string;
}

// Følger omdirigeringer manuelt (samme grund som icsCalendar.ts): Apples
// konto-sharding betyder næsten altid mindst én omdirigering fra
// caldav.icloud.com til en konto-specifik host, og selve legitimations-
// tjekket (401/403) skal ramme HVER omdirigering, ikke kun den første.
async function davRequestFollowingRedirects(
  initialUrl: string,
  init: DavRequestInit,
): Promise<DavResponse> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response: Response;

    try {
      response = await fetch(currentUrl, {
        method: init.method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Authorization: basicAuthHeader(init.credentials),
          ...(init.depth ? { Depth: init.depth } : {}),
          ...(init.body !== undefined ? { "Content-Type": "application/xml; charset=utf-8" } : {}),
          ...init.extraHeaders,
        },
        body: init.body,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ICloudCalDavError("Tidsgrænsen for iCloud-kaldet blev overskredet.", "timeout");
      }
      throw new ICloudCalDavError("Kunne ikke kontakte iCloud.", "network");
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ICloudCalDavError("iCloud afviste loginoplysningerne.", "invalid-credentials");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ICloudCalDavError("iCloud omdirigerede uden mål.", "network");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    const text = await readBodyWithLimit(response, maxResponseBytes);
    return { status: response.status, headers: response.headers, text, finalUrl: currentUrl };
  }

  throw new ICloudCalDavError("For mange omdirigeringer fra iCloud.", "network");
}

interface DavResponseEntry {
  href: string;
  props: Record<string, unknown>;
}

// Multistatus-svar (207) er kernen i WebDAV/CalDAV — én <response> pr.
// ressource, med ét eller flere <propstat> (ét pr. HTTP-status, fx 200 for
// egenskaber der findes, 404 for dem der ikke gør). Kun 200-propstat'et er
// relevant her; et 404-propstat betyder "denne egenskab findes ikke på
// denne ressource", ikke en fejl i selve kaldet.
function parseMultistatus(xmlText: string): DavResponseEntry[] {
  let parsed: unknown;

  try {
    parsed = xmlParser.parse(xmlText);
  } catch {
    throw new ICloudCalDavError("iCloud-svaret kunne ikke læses (ugyldig XML).", "parse-error");
  }

  const root = (parsed as Record<string, unknown> | undefined)?.multistatus as
    | Record<string, unknown>
    | undefined;
  if (!root) return [];

  const responses = toArray(root.response as unknown) as Record<string, unknown>[];

  return responses.map((entry) => {
    const href = typeof entry.href === "string" ? entry.href : "";
    const propstats = toArray(entry.propstat as unknown) as Record<string, unknown>[];
    const okPropstat = propstats.find(
      (propstat) => typeof propstat.status === "string" && propstat.status.includes("200"),
    );
    const props = (okPropstat?.prop as Record<string, unknown> | undefined) ?? {};

    return { href, props };
  });
}

function extractNestedHref(props: Record<string, unknown>, propName: string): string | null {
  const propValue = props[propName] as Record<string, unknown> | undefined;
  const href = propValue?.href;

  if (typeof href === "string") return href;
  if (Array.isArray(href) && typeof href[0] === "string") return href[0];
  return null;
}

function isCalendarCollection(props: Record<string, unknown>): boolean {
  const resourceType = props.resourcetype as Record<string, unknown> | undefined;
  return Boolean(resourceType && "calendar" in resourceType);
}

// Finder brugerens kalender-hjemmemappe (calendar-home-set) i to trin
// (principal → home-set), som CalDAV-protokollen kræver, og lister derefter
// kalenderne i den med deres ctag ("collection tag" — iCloud's modstykke
// til Googles syncToken: uændret ctag betyder ingen nye ændringer, se
// planens afsnit om Google-token-lærdommen).
export async function discoverCalendars(
  credentials: ICloudCredentials,
): Promise<ICloudCalendarInfo[]> {
  const principalBody =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<propfind xmlns="DAV:"><prop><current-user-principal/></prop></propfind>';

  const principalResponse = await davRequestFollowingRedirects(`${caldavBaseUrl}/`, {
    method: "PROPFIND",
    credentials,
    body: principalBody,
    depth: "0",
  });

  const [principalEntry] = parseMultistatus(principalResponse.text);
  const principalHref =
    principalEntry && extractNestedHref(principalEntry.props, "current-user-principal");
  if (!principalHref) {
    throw new ICloudCalDavError("Kunne ikke finde iCloud-kontoens principal.", "parse-error");
  }

  const principalUrl = new URL(principalHref, principalResponse.finalUrl).toString();

  const homeSetBody =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    "<prop><c:calendar-home-set/></prop></propfind>";

  const homeSetResponse = await davRequestFollowingRedirects(principalUrl, {
    method: "PROPFIND",
    credentials,
    body: homeSetBody,
    depth: "0",
  });

  const [homeSetEntry] = parseMultistatus(homeSetResponse.text);
  const homeSetHref = homeSetEntry && extractNestedHref(homeSetEntry.props, "calendar-home-set");
  if (!homeSetHref) {
    throw new ICloudCalDavError("Kunne ikke finde iCloud-kontoens kalender-hjemmemappe.", "parse-error");
  }

  const calendarHomeUrl = new URL(homeSetHref, homeSetResponse.finalUrl).toString();

  const listBody =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<propfind xmlns="DAV:" xmlns:cs="http://calendarserver.org/ns/">' +
    "<prop><resourcetype/><displayname/><cs:getctag/></prop></propfind>";

  const listResponse = await davRequestFollowingRedirects(calendarHomeUrl, {
    method: "PROPFIND",
    credentials,
    body: listBody,
    depth: "1",
  });

  return parseMultistatus(listResponse.text)
    .filter((entry) => isCalendarCollection(entry.props))
    .map((entry) => ({
      url: new URL(entry.href, listResponse.finalUrl).toString(),
      displayName: typeof entry.props.displayname === "string" ? entry.props.displayname : entry.href,
      ctag: typeof entry.props.getctag === "string" ? entry.props.getctag : null,
    }));
}

function formatCalDavTimestamp(isoString: string): string {
  return `${new Date(isoString).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

// Henter hændelser i et tidsvindue via REPORT (calendar-query) — svaret er
// stadig et multistatus-dokument, men hver <prop> indeholder rå
// iCalendar-tekst (calendar-data), som parses med ical.js, samme
// bibliotek som ICS-sporet bruger.
export async function fetchCalendarEvents(
  calendarUrl: string,
  credentials: ICloudCredentials,
  range: { start: string; end: string },
): Promise<ICloudCalendarEvent[]> {
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<c:calendar-query xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    "<prop><getetag/><c:calendar-data/></prop>" +
    '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    `<c:time-range start="${formatCalDavTimestamp(range.start)}" end="${formatCalDavTimestamp(range.end)}"/>` +
    "</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>";

  const response = await davRequestFollowingRedirects(calendarUrl, {
    method: "REPORT",
    credentials,
    body,
    depth: "1",
  });

  const events: ICloudCalendarEvent[] = [];

  for (const entry of parseMultistatus(response.text)) {
    const calendarData = entry.props["calendar-data"];
    if (typeof calendarData !== "string" || !calendarData.trim()) continue;

    let component: InstanceType<typeof ICAL.Component>;
    try {
      component = new ICAL.Component(ICAL.parse(calendarData));
    } catch {
      // Springer en enkelt ulæselig hændelse over frem for at fejle hele
      // synkroniseringen for kalenderen.
      continue;
    }

    for (const vevent of component.getAllSubcomponents("vevent")) {
      const icalEvent = new ICAL.Event(vevent);
      events.push({
        href: new URL(entry.href, response.finalUrl).toString(),
        etag: typeof entry.props.getetag === "string" ? entry.props.getetag : null,
        uid: icalEvent.uid,
        title: icalEvent.summary ?? "",
        start: icalEvent.startDate.toJSDate().toISOString(),
        end: icalEvent.endDate.toJSDate().toISOString(),
        allDay: icalEvent.startDate.isDate,
        description: icalEvent.description || undefined,
        location: icalEvent.location || undefined,
      });
    }
  }

  return events;
}

function buildIcsForEvent(input: ICloudEventInput): string {
  const calendarComponent = new ICAL.Component(["vcalendar", [], []]);
  calendarComponent.updatePropertyWithValue("version", "2.0");
  calendarComponent.updatePropertyWithValue("prodid", "-//Hjemmecentralen//iCloud CalDAV//DA");

  const vevent = new ICAL.Component("vevent");
  const icalEvent = new ICAL.Event(vevent);
  icalEvent.uid = input.uid;
  icalEvent.summary = input.title;
  icalEvent.startDate = ICAL.Time.fromJSDate(new Date(input.start), true);
  icalEvent.endDate = ICAL.Time.fromJSDate(new Date(input.end), true);
  if (input.description) icalEvent.description = input.description;
  if (input.location) icalEvent.location = input.location;

  calendarComponent.addSubcomponent(vevent);
  return calendarComponent.toString();
}

// Opretter/opdaterer en hændelse. `existingEtag` afgør, hvilken
// betingelse der sendes: `If-None-Match: *` ved oprettelse (fejler, hvis
// ressourcen allerede findes) eller `If-Match: <etag>` ved opdatering
// (fejler med 412, hvis en anden enhed har ændret hændelsen i mellemtiden
// — se ICloudCalDavErrorCode "conflict").
export async function putEvent(
  calendarUrl: string,
  input: ICloudEventInput,
  credentials: ICloudCredentials,
  existingEtag: string | null,
): Promise<{ href: string; etag: string | null }> {
  const base = calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`;
  const eventUrl = new URL(`${input.uid}.ics`, base).toString();

  const response = await davRequestFollowingRedirects(eventUrl, {
    method: "PUT",
    credentials,
    body: buildIcsForEvent(input),
    extraHeaders: {
      "Content-Type": "text/calendar; charset=utf-8",
      ...(existingEtag ? { "If-Match": existingEtag } : { "If-None-Match": "*" }),
    },
  });

  if (response.status === 412) {
    throw new ICloudCalDavError("Aftalen er blevet ændret et andet sted siden sidst.", "conflict");
  }
  if (response.status !== 200 && response.status !== 201 && response.status !== 204) {
    throw new ICloudCalDavError(`iCloud afviste skrivningen (status ${response.status}).`, "network");
  }

  return { href: eventUrl, etag: response.headers.get("etag") };
}

export async function deleteEvent(
  eventHref: string,
  credentials: ICloudCredentials,
  etag: string,
): Promise<void> {
  const response = await davRequestFollowingRedirects(eventHref, {
    method: "DELETE",
    credentials,
    extraHeaders: { "If-Match": etag },
  });

  if (response.status === 412) {
    throw new ICloudCalDavError("Aftalen er blevet ændret et andet sted siden sidst.", "conflict");
  }
  if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
    throw new ICloudCalDavError(`iCloud afviste sletningen (status ${response.status}).`, "network");
  }
}
