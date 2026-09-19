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
