import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../env";

const sessionCookieName = "session";
const sessionDurationSeconds = 30 * 24 * 60 * 60; // 30 dage

// Generisk over Variables (ikke bundet til et bestemt sæt), så ruter med
// deres egne c.set()-typer (fx families.ts's { user: SessionUser }) stadig
// kan give deres Context videre til disse hjælpefunktioner.
type AppContext<E extends { Bindings: Env } = { Bindings: Env }> = Context<E>;

// wrangler dev kører over almindelig http://localhost — en "Secure"-flagget
// cookie ville aldrig blive gemt der, så flaget sættes kun når requesten
// reelt kom ind over https (den rigtige deploy, prod såvel som beta).
function isSecureRequest<E extends { Bindings: Env }>(c: AppContext<E>): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  // Sprint 50: hvornår DENNE session sidst gennemførte en frisk OAuth-
  // roundtrip via /auth/reauth/... — null hvis aldrig. Bruges af
  // accountDeletion.ts's isReauthFresh() til at kræve gen-autentificering
  // (ikke bare en gyldig, evt. ugedes-gammel session-cookie) før en
  // destruktiv handling som kontosletning.
  reauthenticatedAt: string | null;
}

export async function createSession<E extends { Bindings: Env }>(
  c: AppContext<E>,
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
  reauthenticatedAt: string | null;
}

export async function getSessionUser<E extends { Bindings: Env }>(
  c: AppContext<E>,
): Promise<SessionUser | null> {
  const sessionId = getCookie(c, sessionCookieName);

  if (!sessionId) {
    return null;
  }

  const row = await c.env.DB.prepare(
    `SELECT users.id AS id, users.email AS email, users.name AS name,
            users.picture_url AS pictureUrl, sessions.expires_at AS expiresAt,
            sessions.reauthenticated_at AS reauthenticatedAt
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
    reauthenticatedAt: row.reauthenticatedAt,
  };
}

// Sprint 50: markerer DENNE session (ikke brugerens øvrige sessioner på
// andre enheder) som lige nu gen-autentificeret — kaldes fra
// auth.ts's /reauth/google og /reauth/microsoft-callbacks, aldrig direkte
// fra en rute. Opdaterer bevidst den eksisterende sessionsrække i stedet
// for at oprette en ny, så resten af sessionens tilstand (created_at,
// expires_at) er uændret.
export async function markSessionReauthenticated<E extends { Bindings: Env }>(
  c: AppContext<E>,
): Promise<void> {
  const sessionId = getCookie(c, sessionCookieName);

  if (!sessionId) {
    return;
  }

  await c.env.DB.prepare("UPDATE sessions SET reauthenticated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), sessionId)
    .run();
}

export async function destroySession<E extends { Bindings: Env }>(
  c: AppContext<E>,
): Promise<void> {
  const sessionId = getCookie(c, sessionCookieName);

  if (sessionId) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId)
      .run();
  }

  deleteCookie(c, sessionCookieName, { path: "/" });
}

// Sprint 24: en session slettes ellers kun, når den selv bruges efter
// udløb (getSessionUser ovenfor) — sessioner der aldrig bruges igen (fx en
// enhed der forsvinder) blev aldrig ryddet op. Kaldes fra scheduled()
// i index.ts (Cron Trigger), ikke fra en bruger-request.
export async function cleanupExpiredSessions(env: Env): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?")
    .bind(new Date().toISOString())
    .run();
}
