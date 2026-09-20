// Sprint 53: børneadgangens egen, letvægts session — se migration 0032's
// kommentar for hvorfor den er adskilt fra lib/session.ts's users/sessions-
// model (et barn uden konto har intet users.id at pege på). Samme
// cookie-mønstre som session.ts, men egen cookie-navn og egen tabel.

import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../env";

const childSessionCookieName = "child_session";
// 30 dage, samme levetid som en almindelig session — bekvemt på et barns
// eget device. Beskyttelsen ligger i at OPRETTE sessionen (kræver
// link+PIN), ikke i selve sessionens levetid.
const childSessionDurationSeconds = 30 * 24 * 60 * 60;

type AppContext<E extends { Bindings: Env } = { Bindings: Env }> = Context<E>;

function isSecureRequest<E extends { Bindings: Env }>(c: AppContext<E>): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export interface ChildSessionMember {
  id: string;
  familyId: string;
  name: string;
  color: string;
}

export async function createChildSession<E extends { Bindings: Env }>(
  c: AppContext<E>,
  familyMemberId: string,
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + childSessionDurationSeconds * 1000);

  await c.env.DB.prepare(
    "INSERT INTO child_sessions (id, family_member_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(sessionId, familyMemberId, now.toISOString(), expiresAt.toISOString())
    .run();

  setCookie(c, childSessionCookieName, sessionId, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: "Lax",
    path: "/",
    maxAge: childSessionDurationSeconds,
  });
}

interface ChildSessionRow {
  id: string;
  familyId: string;
  name: string;
  color: string;
  expiresAt: string;
}

export async function getChildSessionMember<E extends { Bindings: Env }>(
  c: AppContext<E>,
): Promise<ChildSessionMember | null> {
  const sessionId = getCookie(c, childSessionCookieName);

  if (!sessionId) {
    return null;
  }

  const row = await c.env.DB.prepare(
    `SELECT family_members.id AS id, family_members.family_id AS familyId,
            family_members.name AS name, family_members.color AS color,
            child_sessions.expires_at AS expiresAt
     FROM child_sessions
     JOIN family_members ON family_members.id = child_sessions.family_member_id
     WHERE child_sessions.id = ?`,
  )
    .bind(sessionId)
    .first<ChildSessionRow>();

  if (!row) {
    return null;
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await destroyChildSession(c);
    return null;
  }

  // Sprint 55: eneste "aktivitet"-signal, ejer/admin kan se om barnets
  // enheder (se childAccessManagement.ts's sessions-rute) — bevidst kun et
  // tidsstempel, ingen IP/enhedsinformation (se migration 0033's kommentar).
  // waitUntil ville være at foretrække, men denne funktion har ikke adgang
  // til c.executionCtx her uden at ændre alle kaldesteders signatur — et
  // par ekstra ms på et allerede letvægts kald er en accepteret afvejning.
  await c.env.DB.prepare("UPDATE child_sessions SET last_seen_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), sessionId)
    .run();

  return { id: row.id, familyId: row.familyId, name: row.name, color: row.color };
}

export async function destroyChildSession<E extends { Bindings: Env }>(
  c: AppContext<E>,
): Promise<void> {
  const sessionId = getCookie(c, childSessionCookieName);

  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM child_sessions WHERE id = ?").bind(sessionId).run();
  }

  deleteCookie(c, childSessionCookieName, { path: "/" });
}

// Kaldes fra den daglige Cron Trigger (index.ts), samme mønster som
// session.ts's cleanupExpiredSessions().
export async function cleanupExpiredChildSessions(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM child_sessions WHERE expires_at < ?")
    .bind(new Date().toISOString())
    .run();
}

export interface ChildSessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
}

// Sprint 55: ejer/admin-siden af sessionsoverblikket (se
// childAccessManagement.ts) — kun aktive (ikke udløbne) sessioner, samme
// afgrænsning som getChildSessionMember() selv håndhæver ved brug.
export async function listChildSessions(
  db: D1Database,
  familyMemberId: string,
): Promise<ChildSessionSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT id, created_at AS createdAt, last_seen_at AS lastSeenAt
       FROM child_sessions
       WHERE family_member_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .bind(familyMemberId, new Date().toISOString())
    .all<ChildSessionSummary>();

  return results;
}

// Logger ÉN bestemt enhed ud — returnerer om der reelt var en session at
// slette, så ruten kan svare 404 for et sessions-id, der enten aldrig har
// eksisteret eller hører til et andet familiemedlem. Slår op FØR sletning
// (i stedet for at læse .run()'s meta.changes), da testsuitens fakeD1 ikke
// modellerer D1's affected-rows-metadata.
export async function revokeChildSession(
  db: D1Database,
  familyMemberId: string,
  sessionId: string,
): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id FROM child_sessions WHERE id = ? AND family_member_id = ?")
    .bind(sessionId, familyMemberId)
    .first<{ id: string }>();

  if (!existing) {
    return false;
  }

  await db.prepare("DELETE FROM child_sessions WHERE id = ?").bind(sessionId).run();
  return true;
}

// "Log ud på alle enheder" — samme oprydning som allerede sker ved
// rotation/fjernelse af link eller PIN (childAccessManagement.ts), nu også
// tilgængelig som sin egen handling.
export async function revokeAllChildSessions(db: D1Database, familyMemberId: string): Promise<void> {
  await db.prepare("DELETE FROM child_sessions WHERE family_member_id = ?").bind(familyMemberId).run();
}
