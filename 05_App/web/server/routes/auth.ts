import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { Env } from "../env";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
} from "../lib/googleOAuth";
import {
  buildMicrosoftAuthorizeUrl,
  exchangeMicrosoftAuthorizationCode,
  fetchMicrosoftUserInfo,
} from "../lib/microsoftOAuth";
import {
  derivePkceChallenge,
  generateOAuthState,
  generatePkceVerifier,
} from "../lib/oauthPkce";
import { createSession, destroySession, getSessionUser, markSessionReauthenticated } from "../lib/session";
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

// Samme mønster som /google/begin — se dens kommentar for "begin" vs.
// "start"-navngivningen (workers.dev-cache).
auth.get("/microsoft/begin", async (c) => {
  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  const challenge = await derivePkceChallenge(verifier);

  setCookie(c, oauthFlowCookieName, `${state}.${verifier}`, {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/microsoft",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  const redirectUri = `${new URL(c.req.url).origin}/auth/microsoft/callback`;

  const authorizeUrl = buildMicrosoftAuthorizeUrl({
    clientId: c.env.MICROSOFT_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return c.redirect(authorizeUrl);
});

auth.get("/microsoft/callback", async (c) => {
  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const flowCookie = getCookie(c, oauthFlowCookieName);

  deleteCookie(c, oauthFlowCookieName, { path: "/auth/microsoft" });

  if (!code || !returnedState || !flowCookie) {
    return c.text("Login mangler nødvendige parametre. Prøv igen.", 400);
  }

  const [expectedState, verifier] = flowCookie.split(".");

  if (!expectedState || !verifier || expectedState !== returnedState) {
    return c.text("Login kunne ikke bekræftes (forkert state). Prøv igen.", 400);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/microsoft/callback`;

  try {
    const tokens = await exchangeMicrosoftAuthorizationCode({
      clientId: c.env.MICROSOFT_CLIENT_ID,
      clientSecret: await c.env.MICROSOFT_CLIENT_SECRET.get(),
      redirectUri,
      code,
      codeVerifier: verifier,
    });

    const userInfo = await fetchMicrosoftUserInfo(tokens.access_token);
    const now = new Date().toISOString();

    const existing = await c.env.DB.prepare(
      "SELECT id FROM users WHERE microsoft_sub = ?",
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
      // google_sub er NOT NULL (se 0030_microsoft_login.sql for hvorfor det
      // bevidst ikke blev lavet nullable) — en "ms:"-præfikset placeholder,
      // afledt af microsoft_sub, opfylder UNIQUE NOT NULL uden nogensinde at
      // kunne kollidere med en ægte, rent numerisk Google-sub. Intet andet
      // sted i koden læser google_sub som "har forbundet Google" (det gør
      // google_connections-tabellen), så placeholderen er ufarlig.
      await c.env.DB.prepare(
        "INSERT INTO users (id, google_sub, microsoft_sub, email, name, picture_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          userId,
          `ms:${userInfo.sub}`,
          userInfo.sub,
          userInfo.email,
          userInfo.name,
          userInfo.picture ?? null,
          now,
        )
        .run();
    }

    await createSession(c, userId);

    return c.redirect("/");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Microsoft OAuth callback fejlede", message);
    return c.text("Login fejlede. Prøv igen.", 500);
  }
});

auth.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

// Sprint 50: gen-autentificering før en destruktiv handling (kontosletning)
// — se accountDeletion.ts's header-kommentar for hvorfor en almindelig,
// evt. ugedes-gammel session-cookie ikke er nok. Samme "begin -> udbyder ->
// callback"-form som /google og /microsoft ovenfor, men: (1) kræver en
// EKSISTERENDE gyldig session (kan ikke bruges til at logge ind), (2)
// opdaterer den session i stedet for at oprette en ny, og (3) afviser hvis
// den bekræftede identitet ikke er den samme konto, der allerede er logget
// ind — man kan ikke "gen-bekræfte" som en anden bruger.
const reauthReturnCookieName = "reauth_return_to";

function safeReturnTo(value: string | undefined): string {
  // Kun en relativ sti på samme origin — forhindrer et open redirect via en
  // manipuleret returnTo-parameter.
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings";
  }
  return value;
}

// returnTo kan selv indeholde en forespørgselsstreng (fx
// "/settings?accountDeletion=confirm") — "?reauth=success" skal derfor
// tilføjes med "&" i det tilfælde, ikke et andet "?".
function appendReauthSuccess(returnTo: string): string {
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}reauth=success`;
}

auth.get("/reauth/google/begin", async (c) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  const challenge = await derivePkceChallenge(verifier);

  setCookie(c, oauthFlowCookieName, `${state}.${verifier}.${user.id}`, {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/reauth/google",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  setCookie(c, reauthReturnCookieName, safeReturnTo(c.req.query("returnTo")), {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/reauth/google",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  const redirectUri = `${new URL(c.req.url).origin}/auth/reauth/google/callback`;

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: c.env.GOOGLE_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return c.redirect(authorizeUrl);
});

auth.get("/reauth/google/callback", async (c) => {
  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const flowCookie = getCookie(c, oauthFlowCookieName);
  const returnTo = safeReturnTo(getCookie(c, reauthReturnCookieName));

  deleteCookie(c, oauthFlowCookieName, { path: "/auth/reauth/google" });
  deleteCookie(c, reauthReturnCookieName, { path: "/auth/reauth/google" });

  if (!code || !returnedState || !flowCookie) {
    return c.text("Bekræftelse mangler nødvendige parametre. Prøv igen.", 400);
  }

  const [expectedState, verifier, expectedUserId] = flowCookie.split(".");

  if (!expectedState || !verifier || !expectedUserId || expectedState !== returnedState) {
    return c.text("Bekræftelse kunne ikke verificeres (forkert state). Prøv igen.", 400);
  }

  const sessionUser = await getSessionUser(c);

  if (!sessionUser || sessionUser.id !== expectedUserId) {
    return c.text("Sessionen udløb under bekræftelsen. Log ind igen, og prøv forfra.", 401);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/reauth/google/callback`;

  try {
    const tokens = await exchangeGoogleAuthorizationCode({
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: await c.env.GOOGLE_CLIENT_SECRET.get(),
      redirectUri,
      code,
      codeVerifier: verifier,
    });

    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    const matchedUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE id = ? AND google_sub = ?",
    )
      .bind(expectedUserId, userInfo.sub)
      .first<{ id: string }>();

    if (!matchedUser) {
      return c.text(
        "Bekræftelsen var for en anden Google-konto end den, du er logget ind med.",
        403,
      );
    }

    await markSessionReauthenticated(c);

    return c.redirect(appendReauthSuccess(returnTo));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Google re-autentificering fejlede", message);
    return c.text("Bekræftelse fejlede. Prøv igen.", 500);
  }
});

// Samme mønster som /reauth/google ovenfor.
auth.get("/reauth/microsoft/begin", async (c) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  const state = generateOAuthState();
  const verifier = generatePkceVerifier();
  const challenge = await derivePkceChallenge(verifier);

  setCookie(c, oauthFlowCookieName, `${state}.${verifier}.${user.id}`, {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/reauth/microsoft",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  setCookie(c, reauthReturnCookieName, safeReturnTo(c.req.query("returnTo")), {
    httpOnly: true,
    secure: isSecureRequest(c.req.url),
    sameSite: "Lax",
    path: "/auth/reauth/microsoft",
    maxAge: oauthFlowMaxAgeSeconds,
  });

  const redirectUri = `${new URL(c.req.url).origin}/auth/reauth/microsoft/callback`;

  const authorizeUrl = buildMicrosoftAuthorizeUrl({
    clientId: c.env.MICROSOFT_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  return c.redirect(authorizeUrl);
});

auth.get("/reauth/microsoft/callback", async (c) => {
  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const flowCookie = getCookie(c, oauthFlowCookieName);
  const returnTo = safeReturnTo(getCookie(c, reauthReturnCookieName));

  deleteCookie(c, oauthFlowCookieName, { path: "/auth/reauth/microsoft" });
  deleteCookie(c, reauthReturnCookieName, { path: "/auth/reauth/microsoft" });

  if (!code || !returnedState || !flowCookie) {
    return c.text("Bekræftelse mangler nødvendige parametre. Prøv igen.", 400);
  }

  const [expectedState, verifier, expectedUserId] = flowCookie.split(".");

  if (!expectedState || !verifier || !expectedUserId || expectedState !== returnedState) {
    return c.text("Bekræftelse kunne ikke verificeres (forkert state). Prøv igen.", 400);
  }

  const sessionUser = await getSessionUser(c);

  if (!sessionUser || sessionUser.id !== expectedUserId) {
    return c.text("Sessionen udløb under bekræftelsen. Log ind igen, og prøv forfra.", 401);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/reauth/microsoft/callback`;

  try {
    const tokens = await exchangeMicrosoftAuthorizationCode({
      clientId: c.env.MICROSOFT_CLIENT_ID,
      clientSecret: await c.env.MICROSOFT_CLIENT_SECRET.get(),
      redirectUri,
      code,
      codeVerifier: verifier,
    });

    const userInfo = await fetchMicrosoftUserInfo(tokens.access_token);

    const matchedUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE id = ? AND microsoft_sub = ?",
    )
      .bind(expectedUserId, userInfo.sub)
      .first<{ id: string }>();

    if (!matchedUser) {
      return c.text(
        "Bekræftelsen var for en anden Microsoft-konto end den, du er logget ind med.",
        403,
      );
    }

    await markSessionReauthenticated(c);

    return c.redirect(appendReauthSuccess(returnTo));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Microsoft re-autentificering fejlede", message);
    return c.text("Bekræftelse fejlede. Prøv igen.", 500);
  }
});

export default auth;
