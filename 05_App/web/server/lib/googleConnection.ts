// Fase 3: server/routes/calendar.ts's eneste vej til en brugbar
// Google-adgangstoken.
//
// Rettelse 2026-09-12 (Sprint 44-følgeret): kaldte tidligere Googles
// refresh-endpoint OG skrev til D1 ved HVERT ENESTE kald — uanset at et
// adgangstoken er gyldigt i ~1 time. Ved almindelig brug (cron hvert 5.
// minut + rigtige sideindlæsninger) udløste det 100.000+ D1-skrivninger
// på én dag og blokerede Cloudflares gratis skriveloft for hele kontoen
// (se migration 0028). cached_access_token/access_token_expires_at
// genbruges nu, indtil tokenet reelt er ved at udløbe (5 minutters
// sikkerhedsmargin) — typisk ét Google-kald og én D1-skrivning i timen
// pr. bruger i stedet for ét pr. kalenderopslag. Adgangstokenet gemmes i
// klartekst (i modsætning til refresh-tokenet, se tokenEncryption.ts) —
// bevidst, da det i forvejen kun lever ~1 time og er langt mindre
// følsomt end et refresh-token, der giver varig adgang.

import type { Env } from "../env";
import {
  GoogleRefreshTokenInvalidError,
  refreshGoogleAccessToken,
} from "./googleOAuth";
import { decryptRefreshToken } from "./tokenEncryption";

// Kastes både når brugeren aldrig har forbundet Google, og når en tidligere
// forbindelse lige er blevet ryddet pga. et tilbagekaldt/udløbet
// refresh-token — begge tilfælde er "brugeren skal (gen)forbinde", ikke en
// serverfejl.
export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google Kalender er ikke forbundet.");
    this.name = "GoogleNotConnectedError";
  }
}

// Sikkerhedsmargin, så et token der er ved at udløbe midt i et kald ikke
// bliver brugt og afvist af Google — bedre at refreshe lidt for tidligt.
const accessTokenExpiryBufferMs = 5 * 60 * 1000;

interface ConnectionRow {
  encryptedRefreshToken: string;
  cachedAccessToken: string | null;
  accessTokenExpiresAt: string | null;
}

export async function getGoogleAccessToken(
  env: Env,
  userId: string,
): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT encrypted_refresh_token AS encryptedRefreshToken,
            cached_access_token AS cachedAccessToken,
            access_token_expires_at AS accessTokenExpiresAt
     FROM google_connections WHERE user_id = ?`,
  )
    .bind(userId)
    .first<ConnectionRow>();

  if (!row) {
    throw new GoogleNotConnectedError();
  }

  if (row.cachedAccessToken && row.accessTokenExpiresAt) {
    const expiresAt = new Date(row.accessTokenExpiresAt).getTime();
    if (expiresAt - Date.now() > accessTokenExpiryBufferMs) {
      return row.cachedAccessToken;
    }
  }

  const refreshToken = await decryptRefreshToken(
    row.encryptedRefreshToken,
    await env.GOOGLE_TOKEN_ENCRYPTION_KEY.get(),
  );

  try {
    const tokens = await refreshGoogleAccessToken({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: await env.GOOGLE_CLIENT_SECRET.get(),
      refreshToken,
    });

    const accessTokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    await env.DB.prepare(
      `UPDATE google_connections
       SET last_refreshed_at = ?, cached_access_token = ?, access_token_expires_at = ?
       WHERE user_id = ?`,
    )
      .bind(new Date().toISOString(), tokens.access_token, accessTokenExpiresAt, userId)
      .run();

    return tokens.access_token;
  } catch (error) {
    if (error instanceof GoogleRefreshTokenInvalidError) {
      // Fjerner den døde forbindelse, så brugeren får en tydelig
      // "forbind igen"-tilstand i UI'et, i stedet for at samme fejl gentager
      // sig ved hvert kalenderkald fremover.
      await env.DB.prepare("DELETE FROM google_connections WHERE user_id = ?")
        .bind(userId)
        .run();

      throw new GoogleNotConnectedError();
    }

    throw error;
  }
}
