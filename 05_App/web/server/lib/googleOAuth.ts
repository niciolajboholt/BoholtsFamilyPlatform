// Server-side Google OAuth (authorization-code + PKCE), afløser den
// tidligere klient-kun implicit-flow (GoogleCalendarSession.ts, fjernes i
// Fase 3). Beder om identitet (openid/email/profile) og kalender-adgang i
// samme samtykke-trin, per den bekræftede beslutning.

const authorizeEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const userinfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";

// Samme kalender-scopes som den hidtidige klient-flow (googleCalendarConfig.ts)
// + openid/email/profile til selve login-identiteten.
export const googleOAuthScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function derivePkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(digest);
}

export function generateOAuthState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

interface BuildAuthorizeUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

export function buildGoogleAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: BuildAuthorizeUrlOptions): string {
  const url = new URL(authorizeEndpoint);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", googleOAuthScopes);
  // "offline" + "consent" sikrer at der altid følger en refresh-token med —
  // uden "consent" udsteder Google kun én ved selve FØRSTE samtykke pr.
  // bruger+scope-kombination, hvilket ikke er godt nok her (se ADR-017).
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeGoogleAuthorizationCode(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    code: options.code,
    code_verifier: options.codeVerifier,
    grant_type: "authorization_code",
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${response.status} ${body}`);
  }

  return response.json();
}

// Kastes specifikt når Google svarer "invalid_grant" på et refresh-forsøg —
// det betyder brugeren har tilbagekaldt appens adgang (Google-kontoens
// "Tredjeparts-adgang"-side) eller refresh-tokenet er udløbet, ikke en
// forbigående fejl. Kaldestedet (getGoogleAccessToken) bruger dette til at
// rydde google_connections i stedet for at fejle uklart igen og igen.
export class GoogleRefreshTokenInvalidError extends Error {
  constructor() {
    super("Google-adgangen er blevet tilbagekaldt eller er udløbet.");
    this.name = "GoogleRefreshTokenInvalidError";
  }
}

export async function refreshGoogleAccessToken(options: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: options.clientId,
    client_secret: options.clientSecret,
    refresh_token: options.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");

    let errorCode: string | undefined;
    try {
      errorCode = (JSON.parse(responseBody) as { error?: string }).error;
    } catch {
      // Google svarer normalt med JSON — et uparsbart svar behandles som en
      // almindelig (ikke-invalid_grant) fejl herunder.
    }

    if (errorCode === "invalid_grant") {
      throw new GoogleRefreshTokenInvalidError();
    }

    throw new Error(`Google token refresh failed: ${response.status} ${responseBody}`);
  }

  return response.json();
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const response = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo request failed: ${response.status}`);
  }

  return response.json();
}
