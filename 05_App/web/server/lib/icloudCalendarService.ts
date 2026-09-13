import {
  discoverCalendars,
  fetchCalendarEvents,
  putEvent,
  deleteEvent as caldavDeleteEvent,
  ICloudCalDavError,
} from "./icloudCalDav";
import type {
  ICloudCalendarEvent,
  ICloudCalendarInfo,
  ICloudCredentials,
  ICloudEventInput,
} from "./icloudCalDav";
import { decryptRefreshToken, encryptRefreshToken } from "./tokenEncryption";
import type { Env } from "../env";

// Sprint 47: forbindelses-/hændelseslaget mellem icloudConnections.ts-ruterne
// og selve CalDAV-klienten (icloudCalDav.ts). Genbruger Googles krypterings-
// nøgle (GOOGLE_TOKEN_ENCRYPTION_KEY) til den app-specifikke adgangskode —
// funktionen er allerede leverandøruafhængig (se tokenEncryption.ts), og en
// ny Secrets Store-hemmelighed for hvert eneste leverandørspecifikke felt
// ville kun tilføje infrastruktur uden reel sikkerhedsgevinst.

export interface IcloudConnectionRow {
  id: string;
  familyId: string;
  appleIdEmail: string;
  familyMemberId: string | null;
  createdAt: string;
}

async function getEncryptionKey(env: Env): Promise<string> {
  return env.GOOGLE_TOKEN_ENCRYPTION_KEY.get();
}

export async function listIcloudConnections(
  db: D1Database,
  familyId: string,
): Promise<IcloudConnectionRow[]> {
  const result = await db
    .prepare(
      `SELECT id, family_id AS familyId, apple_id_email AS appleIdEmail,
              family_member_id AS familyMemberId, created_at AS createdAt
       FROM icloud_calendar_connections WHERE family_id = ? ORDER BY created_at ASC`,
    )
    .bind(familyId)
    .all<IcloudConnectionRow>();

  return result.results;
}

async function getCredentials(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
): Promise<ICloudCredentials | null> {
  const row = await db
    .prepare(
      `SELECT apple_id_email AS appleIdEmail, encrypted_app_specific_password AS encryptedPassword
       FROM icloud_calendar_connections WHERE id = ? AND family_id = ?`,
    )
    .bind(connectionId, familyId)
    .first<{ appleIdEmail: string; encryptedPassword: string }>();

  if (!row) return null;

  const appSpecificPassword = await decryptRefreshToken(
    row.encryptedPassword,
    await getEncryptionKey(env),
  );

  return { appleIdEmail: row.appleIdEmail, appSpecificPassword };
}

export interface CreateIcloudConnectionParams {
  familyId: string;
  appleIdEmail: string;
  appSpecificPassword: string;
  familyMemberId: string | null;
  createdByUserId: string;
}

// Loginoplysningerne bekræftes ved selve oprettelsen (et rigtigt
// discoverCalendars-kald) — en forbindelse med forkerte loginoplysninger
// gemmes aldrig, i modsætning til ICS-abonnementer, hvor URL'en først
// afprøves ved næste hentning. Kaster ICloudCalDavError uændret, hvis
// bekræftelsen fejler.
export async function createIcloudConnection(
  env: Env,
  db: D1Database,
  params: CreateIcloudConnectionParams,
): Promise<IcloudConnectionRow> {
  const credentials: ICloudCredentials = {
    appleIdEmail: params.appleIdEmail,
    appSpecificPassword: params.appSpecificPassword,
  };

  await discoverCalendars(credentials);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const encryptedPassword = await encryptRefreshToken(
    params.appSpecificPassword,
    await getEncryptionKey(env),
  );

  await db
    .prepare(
      `INSERT INTO icloud_calendar_connections
         (id, family_id, apple_id_email, encrypted_app_specific_password, family_member_id, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, params.familyId, params.appleIdEmail, encryptedPassword, params.familyMemberId, params.createdByUserId, now)
    .run();

  return {
    id,
    familyId: params.familyId,
    appleIdEmail: params.appleIdEmail,
    familyMemberId: params.familyMemberId,
    createdAt: now,
  };
}

export async function deleteIcloudConnection(
  db: D1Database,
  familyId: string,
  connectionId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM icloud_calendar_sync_state WHERE connection_id = ?")
    .bind(connectionId)
    .run();
  await db
    .prepare("DELETE FROM icloud_calendar_connections WHERE id = ? AND family_id = ?")
    .bind(connectionId, familyId)
    .run();
}

export class IcloudConnectionNotFoundError extends Error {
  constructor() {
    super("iCloud-forbindelsen findes ikke i denne familie.");
    this.name = "IcloudConnectionNotFoundError";
  }
}

async function requireCredentials(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
): Promise<ICloudCredentials> {
  const credentials = await getCredentials(env, db, familyId, connectionId);
  if (!credentials) throw new IcloudConnectionNotFoundError();
  return credentials;
}

// Opdaterer også icloud_calendar_sync_state opportunistisk (samme kald
// henter alligevel ctag/displayname) — bruges endnu ikke til noget (cron-
// synkroniseringen er et senere skridt, se planens afsnit om
// Google-token-lærdommen), men sparer et separat kald dagen, det tages i brug.
export async function listCalendarsForConnection(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
): Promise<ICloudCalendarInfo[]> {
  const credentials = await requireCredentials(env, db, familyId, connectionId);
  const calendars = await discoverCalendars(credentials);

  const now = new Date().toISOString();
  await Promise.all(
    calendars.map((calendar) =>
      db
        .prepare(
          `INSERT INTO icloud_calendar_sync_state (connection_id, caldav_calendar_url, display_name, ctag, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(connection_id, caldav_calendar_url) DO UPDATE SET
             display_name = excluded.display_name, ctag = excluded.ctag, updated_at = excluded.updated_at`,
        )
        .bind(connectionId, calendar.url, calendar.displayName, calendar.ctag, now)
        .run(),
    ),
  );

  return calendars;
}

export async function getCalendarEvents(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
  calendarUrl: string,
  range: { start: string; end: string },
): Promise<ICloudCalendarEvent[]> {
  const credentials = await requireCredentials(env, db, familyId, connectionId);
  return fetchCalendarEvents(calendarUrl, credentials, range);
}

export async function createCalendarEvent(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
  calendarUrl: string,
  input: ICloudEventInput,
): Promise<{ href: string; etag: string | null }> {
  const credentials = await requireCredentials(env, db, familyId, connectionId);
  return putEvent(calendarUrl, input, credentials, null);
}

export async function updateCalendarEvent(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
  calendarUrl: string,
  input: ICloudEventInput,
  existingEtag: string,
): Promise<{ href: string; etag: string | null }> {
  const credentials = await requireCredentials(env, db, familyId, connectionId);
  return putEvent(calendarUrl, input, credentials, existingEtag);
}

export async function deleteCalendarEvent(
  env: Env,
  db: D1Database,
  familyId: string,
  connectionId: string,
  eventHref: string,
  etag: string,
): Promise<void> {
  const credentials = await requireCredentials(env, db, familyId, connectionId);
  await caldavDeleteEvent(eventHref, credentials, etag);
}

export function icloudErrorStatus(code: ICloudCalDavError["code"]): 401 | 404 | 409 | 502 | 504 {
  switch (code) {
    case "invalid-credentials":
      return 401;
    case "not-found":
      return 404;
    case "conflict":
      return 409;
    case "timeout":
      return 504;
    default:
      return 502;
  }
}

export { ICloudCalDavError };
