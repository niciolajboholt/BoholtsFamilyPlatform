// Server-side Microsoft OAuth (authorization-code + PKCE), mirror af
// googleOAuth.ts — se 48_Sprint48_Login_Microsoft_Apple_Kalenderforbindelser_Plan.md.
//
// Bruger bevidst "consumers"-tenanten, IKKE "common"/"organizations" —
// det udelukker strukturelt enhver arbejds-/skole-konto under en
// Entra-organisation (fx Nicolajs arbejdsplads P+P Arkitekter) fra
// nogensinde at kunne bruges her. Kun personlige konti
// (Outlook.com/Hotmail/Live) kan logge ind, per eksplicit ønske.
//
// Login beder kun om identitet (openid/email/profile) — ikke
// kalender-scopes. Det er bevidst adskilt fra den separate,
// MSAL-browser-baserede Outlook-kalenderintegration.

const authorizeEndpoint =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const tokenEndpoint =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const userinfoEndpoint = "https://graph.microsoft.com/oidc/userinfo";

export const microsoftOAuthScopes = ["openid", "email", "profile"].join(" ");

interface BuildAuthorizeUrlOptions {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}

export function buildMicrosoftAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: BuildAuthorizeUrlOptions): string {
  const url = new URL(authorizeEndpoint);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", microsoftOAuthScopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export interface MicrosoftTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeMicrosoftAuthorizationCode(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<MicrosoftTokenResponse> {
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
    const responseBody = await response.text().catch(() => "");
    throw new Error(
      `Microsoft token exchange failed: ${response.status} ${responseBody}`,
    );
  }

  return response.json();
}

export interface MicrosoftUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function fetchMicrosoftUserInfo(
  accessToken: string,
): Promise<MicrosoftUserInfo> {
  const response = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Microsoft userinfo request failed: ${response.status}`);
  }

  // Microsofts OIDC-userinfo-endepunkt bruger "name" for visningsnavn
  // ligesom Google, men enkelte kontotyper mangler feltet —
  // "preferred_username" (typisk selve mailadressen) er reserve.
  const data = (await response.json()) as {
    sub: string;
    email?: string;
    name?: string;
    preferred_username?: string;
    picture?: string;
  };

  const email = data.email ?? data.preferred_username;

  if (!email) {
    throw new Error("Microsoft userinfo-svar manglede e-mail");
  }

  return {
    sub: data.sub,
    email,
    name: data.name ?? email,
    picture: data.picture,
  };
}
