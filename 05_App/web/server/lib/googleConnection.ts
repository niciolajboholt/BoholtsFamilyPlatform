// Fase 3: server/routes/calendar.ts's eneste vej til en brugbar
// Google-adgangstoken — kalder Googles token-endpoint med det gemte,
// dekrypterede refresh-token, hver gang, da access-tokens kun lever ~1 time
// og aldrig gemmes selv.

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

interface ConnectionRow {
  encryptedRefreshToken: string;
}

export async function getGoogleAccessToken(
  env: Env,
  userId: string,
): Promise<string> {
  const row = await env.DB.prepare(
    "SELECT encrypted_refresh_token AS encryptedRefreshToken FROM google_connections WHERE user_id = ?",
  )
    .bind(userId)
    .first<ConnectionRow>();

  if (!row) {
    throw new GoogleNotConnectedError();
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

    await env.DB.prepare(
      "UPDATE google_connections SET last_refreshed_at = ? WHERE user_id = ?",
    )
      .bind(new Date().toISOString(), userId)
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
