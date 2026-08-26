import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../env";
import {
  buildGoogleAuthorizeUrl,
  derivePkceChallenge,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  generateOAuthState,
  generatePkceVerifier,
} from "../lib/googleOAuth";
import { createSession, destroySession } from "../lib/session";
import { encryptRefreshToken } from "../lib/tokenEncryption";
import { logError } from "../lib/structuredLog";

const auth = new Hono<{ Bindings: Env }>();

const oauthFlowCookieName = "oauth_flow";
const oauthFlowMaxAgeSeconds = 600; // 10 minutter — nok til at nå gennem Googles samtykke-skærm

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

// Starter login: gemmer state+PKCE-verifier i en kortlivet cookie og sender
// brugeren til Googles samtykke-skærm. redirect_uri udregnes af den
// indkommende request selv (samme domæne request'en kom ind på), så
// prod/beta virker uden separat konfiguration pr. miljø.
// Hedder bevidst "begin", ikke "start": Cloudflares edge-cache for
// workers.dev-domænet cachede engang et 200-svar for "/google/start" og
// ignorerer forespørgselsstrenge i cache-nøglen, så end ikke en
// cache-busting-parameter kunne omgå den fastlåste cache — kun en ny sti kan.
auth.get("/google/begin", async (c) => {
  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  const challenge = await derivePkceChallenge(verifier);

  setCookie(c, oauthFlowCookieName, `${state}.${verifier}`, {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/google",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: c.env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return c.redirect(authorizeUrl);
});

auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const flowCookie = getCookie(c, oauthFlowCookieName);

  deleteCookie(c, oauthFlowCookieName, { path: "/auth/google" });

  if (!code || !returnedState || !flowCookie) {
    return c.text("Login mangler nødvendige parametre. Prøv igen.", 400);
  }

  const [expectedState, verifier] = flowCookie.split(".");

  if (!expectedState || !verifier || expectedState !== returnedState) {
    return c.text("Login kunne ikke bekræftes (forkert state). Prøv igen.", 400);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/google/callback`;

  try {
    const tokens = await exchangeGoogleAuthorizationCode({
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: await c.env.GOOGLE_CLIENT_SECRET.get(),
      redirectUri,
      code,
      codeVerifier: verifier,
    });

    const userInfo = await fetchGoogleUserInfo(tokens.access_token);
    const now = new Date().toISOString();

    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE google_sub = ?",
    )
      .bind(userInfo.sub)
      .first<{ id: string }>();

    const userId = existing?.id ?? crypto.randomUUID();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE users SET email = ?, name = ?, picture_url = ? WHERE id = ?",
      )
        .bind(userInfo.email, userInfo.name, userInfo.picture ?? null, userId)
        .run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, google_sub, email, name, picture_url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          userId,
          userInfo.sub,
          userInfo.email,
          userInfo.name,
          userInfo.picture ?? null,
          now,
        )
        .run();
    }

    // Kun sat, hvis Google reelt sendte en refresh-token med (kun garanteret
    // ved access_type=offline + prompt=consent, som start-ruten altid sætter).
    if (tokens.refresh_token) {
      const encrypted = await encryptRefreshToken(
        tokens.refresh_token,
        await c.env.GOOGLE_TOKEN_ENCRYPTION_KEY.get(),
      );

      await c.env.DB.prepare(
        `INSERT INTO google_connections (user_id, encrypted_refresh_token, scope, connected_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           encrypted_refresh_token = excluded.encrypted_refresh_token,
           scope = excluded.scope,
           connected_at = excluded.connected_at`,
      )
        .bind(userId, encrypted, tokens.scope, now)
        .run();
    }

    await createSession(c, userId);

    return c.redirect("/");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Google OAuth callback fejlede", message);
    return c.text("Login fejlede. Prøv igen.", 500);
  }
});

auth.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

export default auth;
