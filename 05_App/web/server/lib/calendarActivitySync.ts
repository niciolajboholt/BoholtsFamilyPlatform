// Sprint 33 ("Siden sidst du var her" — se
// 01_Project_Documentation/Development/33_Sprint33_Siden_Sidst_Plan.md):
// registrerer nye/flyttede/aflyste kalenderaftaler løbende, så
// aktivitets-endpointet (activity.ts) kan svare uden selv at spørge
// Google ved hvert besøg. Kaldes fra index.ts's scheduled()-handler ved
// hvert eksisterende "*/5 * * * *"-tick (samme tick som opgave- og
// aftale-påmindelser, se taskReminders.ts/eventReminders.ts).
//
// Grupperer pr. familie og bruger familiens EJERs Google-forbindelse til
// alle familiens kalendere (samme mønster som eventReminders.ts og
// weeklySummary.ts) — calendar_member_mappings har intet bruger-id at
// læse et token fra, og cron'en har ingen indlogget bruger.
//
// Google's syncToken rapporterer kun ÆNDRINGER siden sidste kald, ikke
// siden en vilkårlig fortid — første synk for en kalender, og enhver
// gensynk efter et udløbet token (410 Gone), er derfor bevidst en
// BOOTSTRAP: øjebliksbilledet genopbygges fra bunden, men der skrives
// ALDRIG aktivitetslog-rækker for den omgang. Uden det ville lanceringen
// (eller et hvilket som helst 410-fald) klassificere samtlige
// eksisterende aftaler som "nye" og oversvømme "Siden sidst" med falske
// hændelser — et lille vindue af reelle historiske ændringer kan i
// stedet gå tabt, en accepteret begrænsning (se planens Kendte risici).

import type { Env } from "../env";
import { GoogleNotConnectedError, getGoogleAccessToken } from "./googleConnection";
import { getSafeGoogleEventDetails, type SafeGoogleEventDetails } from "./googleCalendarPrivacy";
import { logError } from "./structuredLog";

const googleCalendarApiBaseUrl = "https://www.googleapis.com/calendar/v3";

// Hvor langt frem en bootstrap-synk henter events — matcher
// calendar_activity_log's egen 90-dages retention (se
// cleanupOldCalendarActivity nedenfor), så et event, der kunne optræde i
// aktivitetsloggen, altid også har et snapshot at diffe imod.
const bootstrapWindowDays = 90;

interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  visibility?: string;
  updated?: string;
  recurringEventId?: string;
  originalStartTime?: GoogleEventDateTime;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// Kastes når Google afviser et syncToken som udløbet (410 Gone) — udløser
// en bootstrap-gensynk i stedet for at fejle hele kalenderen.
export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Google Calendar syncToken er udløbet.");
    this.name = "SyncTokenExpiredError";
  }
}

async function fetchEventPage(
  accessToken: string,
  calendarId: string,
  params: { timeMin: string; timeMax: string } | { syncToken: string },
  pageToken: string | undefined,
): Promise<GoogleCalendarEventsResponse> {
  const url = new URL(
    `${googleCalendarApiBaseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
  );

  if ("syncToken" in params) {
    url.searchParams.set("syncToken", params.syncToken);
    // Googles syncToken er knyttet til den oprindelige forespørgsels form.
    // Bootstrap bruger singleEvents=true, så incremental sync skal gøre det
    // samme. Ellers er svaret udefineret, og gentagne aftaler kan skifte fra
    // forekomster til seriemestre mellem de to kald.
    url.searchParams.set("singleEvents", "true");
  } else {
    url.searchParams.set("timeMin", params.timeMin);
    url.searchParams.set("timeMax", params.timeMax);
    url.searchParams.set("singleEvents", "true");
  }

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (response.status === 410) {
    throw new SyncTokenExpiredError();
  }

  if (!response.ok) {
    throw new Error(`Google Calendar svarede ${response.status} for kalender ${calendarId}.`);
  }

  return response.json<GoogleCalendarEventsResponse>();
}

async function fetchAllEvents(
  accessToken: string,
  calendarId: string,
  params: { timeMin: string; timeMax: string } | { syncToken: string },
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken: string | undefined }> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const page = await fetchEventPage(accessToken, calendarId, params, pageToken);
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}

function eventTimes(event: GoogleCalendarEvent): { start: string; end: string } | null {
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = allDay ? `${event.start?.date}T00:00:00.000Z` : event.start?.dateTime;
  const end = allDay ? `${event.end?.date}T00:00:00.000Z` : event.end?.dateTime;

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

interface SnapshotRow {
  safeTitle: string;
  isPrivate: number;
  start: string;
  end: string;
}

async function upsertSnapshot(
  db: D1Database,
  googleCalendarId: string,
  eventId: string,
  safe: SafeGoogleEventDetails,
  times: { start: string; end: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO calendar_event_snapshots
         (google_calendar_id, event_id, safe_title, is_private, start, end)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(google_calendar_id, event_id) DO UPDATE SET
         safe_title = excluded.safe_title,
         is_private = excluded.is_private,
         start = excluded.start,
         end = excluded.end`,
    )
    .bind(googleCalendarId, eventId, safe.title, safe.isPrivate ? 1 : 0, times.start, times.end)
    .run();
}

async function logActivity(
  db: D1Database,
  familyId: string,
  changeType: "created" | "moved" | "cancelled",
  safeTitle: string,
  fields: { oldStart?: string; newStart?: string; sourceUpdatedAt?: string; detectedAt: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO calendar_activity_log
         (id, family_id, change_type, safe_title, old_start, new_start, source_updated_at, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      familyId,
      changeType,
      safeTitle,
      fields.oldStart ?? null,
      fields.newStart ?? null,
      fields.sourceUpdatedAt ?? null,
      fields.detectedAt,
    )
    .run();
}

async function saveSyncToken(
  db: D1Database,
  googleCalendarId: string,
  familyId: string,
  nextSyncToken: string | undefined,
): Promise<void> {
  // Google leverer i sjældne tilfælde intet nextSyncToken (fx et for stort
  // resultat) — uden et gemt token forsøger næste tick simpelthen en ny
  // bootstrap, i stedet for at fejle.
  if (!nextSyncToken) {
    return;
  }

  await db
    .prepare(
      `INSERT INTO calendar_sync_state (google_calendar_id, family_id, sync_token, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_calendar_id) DO UPDATE SET
         sync_token = excluded.sync_token,
         updated_at = excluded.updated_at`,
    )
    .bind(googleCalendarId, familyId, nextSyncToken, new Date().toISOString())
    .run();
}

// Bootstrap (beslutning 5/plan): genopbygger øjebliksbilledet fra bunden
// og gemmer et nyt syncToken — skriver bevidst INGEN aktivitetslog-rækker.
async function bootstrapCalendar(
  db: D1Database,
  accessToken: string,
  googleCalendarId: string,
  familyId: string,
  now: Date,
): Promise<void> {
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + bootstrapWindowDays * 24 * 60 * 60 * 1000).toISOString();

  const { events, nextSyncToken } = await fetchAllEvents(accessToken, googleCalendarId, {
    timeMin,
    timeMax,
  });

  // Et gammelt snapshot kan være forældet (fx efter et 410-fald) — ryddes
  // helt, så det ikke efterlader rækker for events, der ikke længere
  // findes i det nye vindue.
  await db
    .prepare("DELETE FROM calendar_event_snapshots WHERE google_calendar_id = ?")
    .bind(googleCalendarId)
    .run();

  for (const event of events) {
    if (!event.id || event.status === "cancelled") {
      continue;
    }

    const times = eventTimes(event);
    if (!times) {
      continue;
    }

    await upsertSnapshot(db, googleCalendarId, event.id, getSafeGoogleEventDetails(event), times);
  }

  await saveSyncToken(db, googleCalendarId, familyId, nextSyncToken);
}

// Delta (beslutning 3/plan): sammenligner hver ændret event mod det
// gemte snapshot for at afgøre created/moved/cancelled.
async function deltaSyncCalendar(
  db: D1Database,
  accessToken: string,
  googleCalendarId: string,
  familyId: string,
  syncToken: string,
  now: Date,
): Promise<void> {
  const { events, nextSyncToken } = await fetchAllEvents(accessToken, googleCalendarId, { syncToken });
  const loggedCreatedSeriesIds = new Set<string>();

  for (const event of events) {
    await applyDelta(db, googleCalendarId, familyId, event, now, loggedCreatedSeriesIds);
  }

  await saveSyncToken(db, googleCalendarId, familyId, nextSyncToken);
}

async function applyDelta(
  db: D1Database,
  googleCalendarId: string,
  familyId: string,
  event: GoogleCalendarEvent,
  now: Date,
  loggedCreatedSeriesIds: Set<string>,
): Promise<void> {
  if (!event.id) {
    return;
  }

  const existing = await db
    .prepare(
      `SELECT safe_title AS safeTitle, is_private AS isPrivate, start, end
       FROM calendar_event_snapshots WHERE google_calendar_id = ? AND event_id = ?`,
    )
    .bind(googleCalendarId, event.id)
    .first<SnapshotRow>();

  const detectedAt = now.toISOString();

  if (event.status === "cancelled") {
    // Kun rapportér en aflysning, hvis vi rent faktisk kendte eventet i
    // forvejen — en aflyst forekomst af en gentagende aftale, vi aldrig
    // så, har intet at "have været" for brugeren.
    if (existing) {
      await logActivity(db, familyId, "cancelled", existing.safeTitle, {
        oldStart: existing.start,
        sourceUpdatedAt: event.updated,
        detectedAt,
      });

      await db
        .prepare("DELETE FROM calendar_event_snapshots WHERE google_calendar_id = ? AND event_id = ?")
        .bind(googleCalendarId, event.id)
        .run();
    }

    return;
  }

  const times = eventTimes(event);
  if (!times) {
    return;
  }

  const safe = getSafeGoogleEventDetails(event);

  if (!existing) {
    // Google udfolder en ny gentagende serie til mange forekomster, når
    // singleEvents=true. Overblikket skal vise serien som én ny aftale, ikke
    // fx 52 næsten ens aktiviteter. Alle forekomster gemmes stadig som
    // snapshots, så senere flytning/aflysning af én forekomst kan opdages.
    if (!event.recurringEventId || !loggedCreatedSeriesIds.has(event.recurringEventId)) {
      await logActivity(db, familyId, "created", safe.title, { newStart: times.start, sourceUpdatedAt: event.updated, detectedAt });
      if (event.recurringEventId) loggedCreatedSeriesIds.add(event.recurringEventId);
    }
  } else if (existing.start !== times.start || existing.end !== times.end) {
    await logActivity(db, familyId, "moved", safe.title, {
      oldStart: existing.start,
      newStart: times.start,
      sourceUpdatedAt: event.updated,
      detectedAt,
    });
  }
  // En redigering uden ændret start/slut (fx kun titel/beskrivelse)
  // opdaterer snapshottet nedenfor, men rapporteres bevidst ikke som
  // aktivitet — planen dækker kun nye/flyttede/aflyste aftaler.

  await upsertSnapshot(db, googleCalendarId, event.id, safe, times);
}

async function syncOneCalendar(
  env: Env,
  accessToken: string,
  googleCalendarId: string,
  familyId: string,
  now: Date,
): Promise<void> {
  const state = await env.DB.prepare(
    "SELECT sync_token AS syncToken FROM calendar_sync_state WHERE google_calendar_id = ?",
  )
    .bind(googleCalendarId)
    .first<{ syncToken: string }>();

  if (!state) {
    await bootstrapCalendar(env.DB, accessToken, googleCalendarId, familyId, now);
    return;
  }

  try {
    await deltaSyncCalendar(env.DB, accessToken, googleCalendarId, familyId, state.syncToken, now);
  } catch (error) {
    if (error instanceof SyncTokenExpiredError) {
      await bootstrapCalendar(env.DB, accessToken, googleCalendarId, familyId, now);
      return;
    }

    throw error;
  }
}

interface CalendarMappingRow {
  googleCalendarId: string;
  familyId: string;
}

/**
 * Kaldes ved hvert 5-minutters cron-tick. Grupperer familiens kalendere,
 * så adgangstokenet kun hentes én gang pr. familie, ikke én gang pr.
 * kalender — samme mønster som sendDueEventReminders(). Én families eller
 * ét kalenders fejl må ikke blokere resten — fejl logges og næste
 * kalender/familie forsøges.
 */
export async function syncCalendarActivity(env: Env, now: Date = new Date()): Promise<void> {
  const { results: mappings } = await env.DB.prepare(
    "SELECT DISTINCT google_calendar_id AS googleCalendarId, family_id AS familyId FROM calendar_member_mappings",
  ).all<CalendarMappingRow>();

  const calendarIdsByFamily = new Map<string, string[]>();

  for (const mapping of mappings) {
    const existing = calendarIdsByFamily.get(mapping.familyId);
    if (existing) {
      existing.push(mapping.googleCalendarId);
    } else {
      calendarIdsByFamily.set(mapping.familyId, [mapping.googleCalendarId]);
    }
  }

  for (const [familyId, googleCalendarIds] of calendarIdsByFamily) {
    try {
      const family = await env.DB.prepare("SELECT owner_user_id AS ownerUserId FROM families WHERE id = ?")
        .bind(familyId)
        .first<{ ownerUserId: string }>();

      if (!family) {
        continue;
      }

      const accessToken = await getGoogleAccessToken(env, family.ownerUserId);

      for (const googleCalendarId of googleCalendarIds) {
        await syncOneCalendar(env, accessToken, googleCalendarId, familyId, now);
      }
    } catch (error: unknown) {
      if (error instanceof GoogleNotConnectedError) {
        continue;
      }

      logError("Kalender-aktivitetssynk fejlede", error, { familyId });
    }
  }
}

// Ryddes fra samme daglige Cron Trigger som cleanupExpiredSessions() og
// cleanupOldRateLimitAttempts() (index.ts) — se migration 0020's
// kommentar. Giver samtidig en naturlig øvre grænse for, hvor langt
// tilbage "Siden sidst" kan vise kalenderaktivitet.
export async function cleanupOldCalendarActivity(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare("DELETE FROM calendar_activity_log WHERE detected_at < ?").bind(cutoff).run();
}
