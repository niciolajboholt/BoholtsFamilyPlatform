// Sprint 31: sender tidsbaserede aftale-påmindelser. Kaldes fra index.ts's
// scheduled()-handler ved hvert "*/5 * * * *"-tick (samme tick som
// taskReminders.ts, se dens kommentar for hvorfor 5 minutter er
// bucket-størrelsen).
//
// I modsætning til opgave-påmindelser (rene D1-rækker) er en aftale en
// Google-kalenderaftale — dette job henter derfor aftalens AKTUELLE
// start-tidspunkt direkte fra Google ved hvert tick, i stedet for at stole
// på et snapshot taget da påmindelsen blev sat (en aftale kan jo være
// flyttet siden).

import type { Env } from "../env";
import { logError } from "./structuredLog";
import { GoogleNotConnectedError, getGoogleAccessToken } from "./googleConnection";
import { decodeGoogleEventId } from "./googleEventIds";
import { sendPushNotificationToFamily } from "./pushNotifications";
import { isPrivateGoogleEvent } from "./googleCalendarPrivacy";

const googleCalendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  status?: string;
  start?: GoogleEventDateTime;
  recurrence?: string[];
  visibility?: string;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
}

function toInstant(dateTime: GoogleEventDateTime | undefined): Date | null {
  if (!dateTime) {
    return null;
  }

  if (dateTime.dateTime) {
    const instant = new Date(dateTime.dateTime);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }

  if (dateTime.date) {
    // Heldags-aftaler har intet klokkeslæt — lokal midnat samme dag er den
    // eneste meningsfulde reference for "X dage før", ligesom
    // googleCalendarMapper.ts's toLocalMidnightIso gør client-side.
    const instant = new Date(`${dateTime.date}T00:00:00`);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }

  return null;
}

// Finder den NÆSTE forekomst (>= now) af en gentagende aftale — bruges kun
// når det gemte event-id peger på selve rækken (har et "recurrence"-array),
// ikke én bestemt forekomst. Googles instances-endpoint sorterer i
// stigende starttid, så første resultat er det korrekte.
async function fetchNextOccurrence(
  accessToken: string,
  calendarId: string,
  masterEventId: string,
  now: Date,
): Promise<GoogleCalendarEvent | null> {
  const url = new URL(
    `${googleCalendarApiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(masterEventId)}/instances`,
  );
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("maxResults", "1");

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json<GoogleCalendarEventsResponse>();
  return payload.items?.[0] ?? null;
}

async function fetchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEvent | null> {
  const response = await fetch(
    `${googleCalendarApiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    return null;
  }

  return response.json<GoogleCalendarEvent>();
}

function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes % (24 * 60) === 0) {
    const days = offsetMinutes / (24 * 60);
    return days === 1 ? "1 dag" : `${days} dage`;
  }

  if (offsetMinutes % 60 === 0) {
    const hours = offsetMinutes / 60;
    return hours === 1 ? "1 time" : `${hours} timer`;
  }

  return `${offsetMinutes} minutter`;
}

interface ReminderRow {
  id: string;
  familyId: string;
  eventId: string;
  offsetMinutes: number;
  lastSentOccurrenceStart: string | null;
}

interface FamilyOwnerRow {
  ownerUserId: string;
}

async function processReminder(
  env: Env,
  accessToken: string,
  reminder: ReminderRow,
  now: Date,
  windowEnd: Date,
): Promise<void> {
  const decoded = decodeGoogleEventId(reminder.eventId);

  if (!decoded) {
    return;
  }

  const event = await fetchEvent(accessToken, decoded.calendarId, decoded.eventId);

  if (!event || event.status === "cancelled") {
    return;
  }

  // event.recurrence er kun sat på selve RÆKKEN (masteren) — se
  // eventReminders.ts (server-ruten)'s resolveCanonicalEventId, som altid
  // gemmer mod masteren for en gentagende aftale.
  const occurrence = event.recurrence
    ? await fetchNextOccurrence(accessToken, decoded.calendarId, decoded.eventId, now)
    : event;

  const occurrenceStart = toInstant(occurrence?.start);

  if (!occurrence || !occurrenceStart) {
    return;
  }

  const occurrenceStartIso = occurrenceStart.toISOString();

  if (occurrenceStartIso === reminder.lastSentOccurrenceStart) {
    return;
  }

  const remindAt = new Date(occurrenceStart.getTime() - reminder.offsetMinutes * 60_000);

  if (remindAt < now || remindAt >= windowEnd) {
    return;
  }

  const isPrivate = isPrivateGoogleEvent(occurrence) || isPrivateGoogleEvent(event);
  const title = occurrence.summary || event.summary || "Aftale";

  // Ingen handlende bruger at undtage for en tidsbaseret, system-udløst
  // påmindelse — samme mønster/begrundelse som taskReminders.ts og
  // weeklySummary.ts.
  await sendPushNotificationToFamily(env, reminder.familyId, "", {
    title: "Påmindelse",
    body: isPrivate
      ? `En privat aftale er om ${formatOffsetLabel(reminder.offsetMinutes)}.`
      : `"${title}" er om ${formatOffsetLabel(reminder.offsetMinutes)}.`,
    url: "/calendar",
  });

  await env.DB.prepare("UPDATE event_reminders SET last_sent_occurrence_start = ? WHERE id = ?")
    .bind(occurrenceStartIso, reminder.id)
    .run();
}

/**
 * Kaldes ved hvert 5-minutters cron-tick. Grupperer familiens påmindelser,
 * så adgangstokenet kun hentes én gang pr. familie, ikke én gang pr.
 * påmindelse. Én families eller ét events fejl må ikke blokere resten —
 * fejl logges og næste forsøges.
 */
export async function sendDueEventReminders(env: Env, now: Date = new Date()): Promise<void> {
  const windowEnd = new Date(now.getTime() + 5 * 60_000);

  const { results: reminders } = await env.DB.prepare(
    `SELECT id, family_id AS familyId, event_id AS eventId, offset_minutes AS offsetMinutes,
            last_sent_occurrence_start AS lastSentOccurrenceStart
     FROM event_reminders`,
  ).all<ReminderRow>();

  const remindersByFamily = new Map<string, ReminderRow[]>();

  for (const reminder of reminders) {
    const existing = remindersByFamily.get(reminder.familyId);
    if (existing) {
      existing.push(reminder);
    } else {
      remindersByFamily.set(reminder.familyId, [reminder]);
    }
  }

  for (const [familyId, familyReminders] of remindersByFamily) {
    try {
      const family = await env.DB.prepare("SELECT owner_user_id AS ownerUserId FROM families WHERE id = ?")
        .bind(familyId)
        .first<FamilyOwnerRow>();

      if (!family) {
        continue;
      }

      const accessToken = await getGoogleAccessToken(env, family.ownerUserId);

      for (const reminder of familyReminders) {
        await processReminder(env, accessToken, reminder, now, windowEnd);
      }
    } catch (error: unknown) {
      if (error instanceof GoogleNotConnectedError) {
        continue;
      }

      logError("Aftale-påmindelser fejlede", error, { familyId });
    }
  }
}
