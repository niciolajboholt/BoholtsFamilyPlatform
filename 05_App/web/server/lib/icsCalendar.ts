import ICAL from "ical.js";

import { getSafeIcsEventDetails } from "./icsCalendarPrivacy";

// Fase 9: henter og fortolker et ICS-abonnements kalenderfil. Modsat Google/
// Outlook (faste, kendte API-endpoints) er URL'en her bruger-angivet, så
// selve hentningen er den første kode i repoet, der reelt skal værne mod
// SSRF — se validateIcsUrl/isBlockedIcsHost nedenfor. Cloudflare Workers'
// netværkslag blokerer i sig selv direkte routing til private IP-intervaller
// fra en Worker, men denne fil antager IKKE det som eneste værn — den er et
// selvstændigt, forsvar-i-dybden-lag, uafhængigt af platform-adfærd.
//
// ical.js (ren ESM, ingen Node-specifikke API'er, ingen afhængigheder) er
// valgt frem for en separat ICS-parser + en separat rrule-pakke: den
// håndterer begge dele i ét bibliotek, inkl. korrekt RRULE-udfoldning via
// ICAL.Event.iterator()/getOccurrenceDetails().

export type IcsFetchErrorCode =
  | "invalid-url"
  | "blocked-host"
  | "network"
  | "too-large"
  | "timeout"
  | "parse-error";

export class IcsFetchError extends Error {
  code: IcsFetchErrorCode;

  constructor(message: string, code: IcsFetchErrorCode) {
    super(message);
    this.code = code;
  }
}

export interface IcsCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
  isPrivate: boolean;
}

export interface IcsFetchRange {
  start: string;
  end: string;
}

const maxResponseBytes = 2 * 1024 * 1024;
const fetchTimeoutMs = 10_000;
const maxRedirects = 3;
// Samme filosofi som expandRecurringEvents.ts's 730-forekomstsloft — et
// forsvarligt loft mod en ubegrænset/meget lang RRULE, uden at det kræver et
// UNTIL/COUNT i kilden.
const maxOccurrencesPerEvent = 500;

const blockedHostnames = new Set(["localhost", "0.0.0.0"]);

function parseIPv4(hostname: string): [number, number, number, number] | null {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;

  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;

  return parts as [number, number, number, number];
}

function isBlockedIPv4([a, b]: [number, number, number, number]): boolean {
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, inkl. cloud metadata (169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast + reserveret
  return false;
}

function isBlockedIPv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true; // unique local, fc00::/7

  if (normalized.startsWith("::ffff:")) {
    const embeddedIPv4 = parseIPv4(normalized.slice("::ffff:".length));
    if (embeddedIPv4) return isBlockedIPv4(embeddedIPv4);
  }

  return false;
}

export function isBlockedIcsHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    blockedHostnames.has(normalized) ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  const ipv4 = parseIPv4(normalized);
  if (ipv4) return isBlockedIPv4(ipv4);

  if (normalized.includes(":")) return isBlockedIPv6(normalized);

  return false;
}

function validateIcsUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new IcsFetchError("Ugyldigt kalenderlink.", "invalid-url");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new IcsFetchError("Kun http- og https-links understøttes.", "invalid-url");
  }

  if (isBlockedIcsHost(parsed.hostname)) {
    throw new IcsFetchError("Dette kalenderlink peger på en ikke-tilladt adresse.", "blocked-host");
  }

  return parsed;
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
      throw new IcsFetchError("Kalenderfilen er for stor.", "too-large");
    }

    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode();
  return result;
}

// redirect: "manual" + selv opfølgende omdirigering (i stedet for fetchs
// egen "follow") — sikrer at HVER omdirigerings-URL også valideres mod
// isBlockedIcsHost, ikke kun den oprindelige.
async function fetchIcsText(rawUrl: string): Promise<string> {
  let currentUrl = validateIcsUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), fetchTimeoutMs);
    let response: Response;

    try {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "text/calendar, text/plain, */*" },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new IcsFetchError("Tidsgrænsen for hentning blev overskredet.", "timeout");
      }
      throw new IcsFetchError("Kunne ikke hente kalenderen.", "network");
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new IcsFetchError("Kalenderlinket omdirigerer uden mål.", "network");
      }
      currentUrl = validateIcsUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      throw new IcsFetchError(`Kalenderen svarede med status ${response.status}.`, "network");
    }

    return await readBodyWithLimit(response, maxResponseBytes);
  }

  throw new IcsFetchError("For mange omdirigeringer.", "network");
}

export function parseIcsEvents(icsText: string, range: IcsFetchRange): IcsCalendarEvent[] {
  let comp: InstanceType<typeof ICAL.Component>;

  try {
    comp = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    throw new IcsFetchError("Kalenderfilen kunne ikke læses.", "parse-error");
  }

  const rangeStartMs = new Date(range.start).getTime();
  const rangeEndMs = new Date(range.end).getTime();
  const events: IcsCalendarEvent[] = [];

  for (const vevent of comp.getAllSubcomponents("vevent")) {
    const status = vevent.getFirstPropertyValue("status") as string | null;
    if (status?.toUpperCase() === "CANCELLED") continue;

    const icalEvent = new ICAL.Event(vevent);
    if (!icalEvent.uid || !icalEvent.startDate) continue;

    const classValue = vevent.getFirstPropertyValue("class") as string | null;
    const safeDetails = getSafeIcsEventDetails({
      class: classValue ?? undefined,
      summary: icalEvent.summary ?? undefined,
      description: icalEvent.description ?? undefined,
      location: icalEvent.location ?? undefined,
    });

    if (icalEvent.isRecurring()) {
      const iterator = icalEvent.iterator();
      let next: InstanceType<typeof ICAL.Time> | null;
      let occurrenceCount = 0;

      while (occurrenceCount < maxOccurrencesPerEvent && (next = iterator.next())) {
        occurrenceCount++;
        const details = icalEvent.getOccurrenceDetails(next);
        const occurrenceStart = details.startDate.toJSDate();
        const occurrenceEnd = details.endDate.toJSDate();

        if (occurrenceStart.getTime() > rangeEndMs) break;
        if (occurrenceEnd.getTime() < rangeStartMs) continue;

        events.push({
          id: `${icalEvent.uid}:${details.startDate.toICALString()}`,
          title: safeDetails.title,
          description: safeDetails.description,
          location: safeDetails.location,
          isPrivate: safeDetails.isPrivate,
          allDay: details.startDate.isDate,
          start: occurrenceStart.toISOString(),
          end: occurrenceEnd.toISOString(),
        });
      }
      continue;
    }

    const start = icalEvent.startDate.toJSDate();
    const end = (icalEvent.endDate ?? icalEvent.startDate).toJSDate();
    if (end.getTime() < rangeStartMs || start.getTime() > rangeEndMs) continue;

    events.push({
      id: icalEvent.uid,
      title: safeDetails.title,
      description: safeDetails.description,
      location: safeDetails.location,
      isPrivate: safeDetails.isPrivate,
      allDay: icalEvent.startDate.isDate,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  return events;
}

export async function fetchAndParseIcsCalendar(
  url: string,
  range: IcsFetchRange,
): Promise<IcsCalendarEvent[]> {
  const text = await fetchIcsText(url);
  return parseIcsEvents(text, range);
}
