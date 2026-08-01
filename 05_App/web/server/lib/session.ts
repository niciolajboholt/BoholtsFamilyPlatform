import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../env";

const sessionCookieName = "session";
const sessionDurationSeconds = 30 * 24 * 60 * 60; // 30 dage

type AppContext = Context<{ Bindings: Env }>;

// wrangler dev kører over almindelig http://localhost — en "Secure"-flagget
// cookie ville aldrig blive gemt der, så flaget sættes kun når requesten
// reelt kom ind over https (den rigtige deploy, prod såvel som beta).
function isSecureRequest(c: AppContext): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
}

export async function createSession(
  c: AppContext,
  userId: string,
): Promise<void> {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + sessionDurationSeconds * 1000,
  );

  await c.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(sessionId, userId, now.toISOString(), expiresAt.toISOString())
    .run();

  setCookie(c, sessionCookieName, sessionId, {
    httpOnly: true,
    secure: isSecureRequest(c),
    sameSite: "Lax",
    path: "/",
    maxAge: sessionDurationSeconds,
  });
}

interface SessionRow {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  expiresAt: string;
}

export async function getSessionUser(
  c: AppContext,
): Promise<SessionUser | null> {
  const sessionId = getCookie(c, sessionCookieName);

  if (!sessionId) {
    return null;
  }

  const row = await c.env.DB.prepare(
    `SELECT users.id AS id, users.email AS email, users.name AS name,
            users.picture_url AS pictureUrl, sessions.expires_at AS expiresAt
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
  )
    .bind(sessionId)
    .first<SessionRow>();

  if (!row) {
    return null;
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await destroySession(c);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    pictureUrl: row.pictureUrl,
  };
}

export async function destroySession(c: AppContext): Promise<void> {
  const sessionId = getCookie(c, sessionCookieName);

  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId)
      .run();
  }

  deleteCookie(c, sessionCookieName, { path: "/" });
}
