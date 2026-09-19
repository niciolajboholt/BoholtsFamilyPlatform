// Sprint 50: kontosletning (selv-sletning) — se
// server/lib/accountDeletion.ts's header-kommentar for den fulde
// baggrund. Familiens EGEN sletning (kun ejer) ligger i stedet under
// /api/families/:id/deletion (familyRoutes/familyDeletion.ts), da den
// kræver et familie-id og en ejer-rolle-tjek, denne fil ikke har brug for.
import { Hono } from "hono";

import {
  AccountOwnsFamiliesError,
  cancelAccountDeletion,
  DeletionAlreadyRequestedError,
  InvalidDeletionConfirmationError,
  isReauthFresh,
  previewAccountDeletion,
  requestAccountDeletion,
} from "../lib/accountDeletion";
import type { Env } from "../env";
import { checkRateLimit } from "../lib/rateLimit";
import { getSessionUser, type SessionUser } from "../lib/session";
import { logError } from "../lib/structuredLog";

type Variables = { user: SessionUser };

const account = new Hono<{ Bindings: Env; Variables: Variables }>();

account.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Konto-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

account.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

const deletionRequestRateLimit = { maxAttempts: 5, windowMs: 60 * 60 * 1000 };

// Viser konsekvensen (hvilke familier brugeren er medlem af, og som rolle)
// før en egentlig sletningsanmodning — trin 1 af det to-trins flow.
account.get("/deletion/preview", async (c) => {
  const user = c.get("user");
  const preview = await previewAccountDeletion(c.env.DB, user.id);
  return c.json(preview);
});

// Trin 2: kræver en frisk gen-autentificering (se auth.ts's
// /reauth/google og /reauth/microsoft) — sessionens reauthenticatedAt skal
// være sat inden for de seneste minutter (isReauthFresh()), ikke bare en
// gyldig, evt. ugedes-gammel session-cookie.
account.post("/deletion/request", async (c) => {
  const user = c.get("user");
  const body: { confirmation?: string } = await c.req
    .json<{ confirmation?: string }>()
    .catch(() => ({}));

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "account-deletion-request",
    key: user.id,
    ...deletionRequestRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  if (!isReauthFresh(user.reauthenticatedAt)) {
    return c.json(
      { error: "Gen-autentificering krævet. Bekræft din identitet igen, og prøv derefter forfra." },
      403,
    );
  }

  try {
    const { purgeAfter } = await requestAccountDeletion(c.env.DB, {
      userId: user.id,
      reauthenticatedAt: user.reauthenticatedAt as string,
      confirmation: body.confirmation ?? "",
    });

    return c.json({ purgeAfter });
  } catch (error) {
    if (error instanceof AccountOwnsFamiliesError) {
      return c.json(
        {
          error: error.message,
          code: "ownership_transfer_required",
          ownedFamilies: error.families,
        },
        409,
      );
    }
    if (error instanceof InvalidDeletionConfirmationError) {
      return c.json({ error: error.message, code: "invalid_confirmation" }, 400);
    }
    if (error instanceof DeletionAlreadyRequestedError) {
      return c.json({ error: error.message }, 409);
    }
    throw error;
  }
});

// Fortryder en igangværende sletningsanmodning — kræver kun et gyldigt
// login (ikke fresh reauth), da dette er en ikke-destruktiv handling, der
// blot genopretter status quo.
account.post("/deletion/cancel", async (c) => {
  const user = c.get("user");
  const cancelled = await cancelAccountDeletion(c.env.DB, user.id);

  if (!cancelled) {
    return c.json({ error: "Ingen igangværende sletningsanmodning fundet." }, 404);
  }

  return c.json({ ok: true });
});

export default account;
