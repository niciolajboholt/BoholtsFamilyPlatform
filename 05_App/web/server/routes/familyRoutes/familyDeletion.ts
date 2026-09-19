// Sprint 50: server-side dataeksport (alle medlemmer) og hele familiens
// sletning (kun ejer) — se server/lib/accountDeletion.ts og
// server/lib/dataExport.ts's header-kommentarer for baggrunden. Et
// almindeligt medlems egen kontosletning ligger i stedet under
// /api/account (routes/account.ts), da den ikke kræver et familie-id.
import { Hono } from "hono";

import {
  cancelFamilyDeletion,
  DeletionAlreadyRequestedError,
  InvalidDeletionConfirmationError,
  isReauthFresh,
  previewFamilyDeletion,
  requestFamilyDeletion,
} from "../../lib/accountDeletion";
import { buildFamilyExport, buildMemberExport } from "../../lib/dataExport";
import type { Env } from "../../env";
import { getMembershipForFamily } from "../../lib/familyMembership";
import { checkRateLimit } from "../../lib/rateLimit";
import { type Variables } from "./familyQueries";

const familyDeletion = new Hono<{ Bindings: Env; Variables: Variables }>();

const exportRateLimit = { maxAttempts: 10, windowMs: 60 * 60 * 1000 };
const deletionRequestRateLimit = { maxAttempts: 5, windowMs: 60 * 60 * 1000 };

// Omfanget afhænger af rollen, jf. Nicolajs beslutning på planens åbne
// produktbeslutning 3: ejeren får familiens fulde data (inkl. andre
// medlemmers navn/e-mail), et almindeligt medlem kun sin egen kalender/
// opgaver plus egen konto.
familyDeletion.get("/:id/export", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership) {
    return c.json({ error: "Ikke fundet." }, 404);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "family-export",
    key: user.id,
    ...exportRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forsøg. Prøv igen om lidt." }, 429);
  }

  if (membership.role === "owner") {
    return c.json(await buildFamilyExport(c.env.DB, familyId));
  }

  return c.json(await buildMemberExport(c.env.DB, familyId, user.id));
});

// Viser konsekvensen af at slette HELE familien (kun ejer) — trin 1.
familyDeletion.get("/:id/deletion/preview", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || membership.role !== "owner") {
    return c.json({ error: "Kun ejeren kan slette hele familien." }, 403);
  }

  const preview = await previewFamilyDeletion(c.env.DB, familyId);
  return c.json(preview);
});

// Trin 2: kræver ejer-rolle OG en frisk gen-autentificering (samme
// isReauthFresh()-tjek som personlig kontosletning, se
// routes/account.ts).
familyDeletion.post("/:id/deletion/request", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");
  const body: { confirmation?: string } = await c.req
    .json<{ confirmation?: string }>()
    .catch(() => ({}));
  const membership = await getMembershipForFamily(c.env.DB, familyId, user.id);

  if (!membership || membership.role !== "owner") {
    return c.json({ error: "Kun ejeren kan slette hele familien." }, 403);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "family-deletion-request",
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
    const { purgeAfter } = await requestFamilyDeletion(c.env.DB, {
      familyId,
      requestedByUserId: user.id,
      reauthenticatedAt: user.reauthenticatedAt as string,
      confirmation: body.confirmation ?? "",
    });

    return c.json({ purgeAfter });
  } catch (error) {
    if (error instanceof InvalidDeletionConfirmationError) {
      return c.json({ error: error.message, code: "invalid_confirmation" }, 400);
    }
    if (error instanceof DeletionAlreadyRequestedError) {
      return c.json({ error: error.message }, 409);
    }
    throw error;
  }
});

// families.deleted_at gør familien 404 for ALLE (inkl. ejeren) via
// getMembershipForFamily med det samme sletningen er anmodet — så
// fortrydelse kan IKKE gå gennem den almindelige medlemskabs-middleware.
// cancelFamilyDeletion() tjekker i stedet direkte, at den nuværende bruger
// er den, der bad om sletningen.
familyDeletion.post("/:id/deletion/cancel", async (c) => {
  const user = c.get("user");
  const familyId = c.req.param("id");

  const cancelled = await cancelFamilyDeletion(c.env.DB, {
    familyId,
    requestedByUserId: user.id,
  });

  if (!cancelled) {
    return c.json({ error: "Ingen igangværende sletningsanmodning fundet." }, 404);
  }

  return c.json({ ok: true });
});

export default familyDeletion;
