// Sprint 26: den ENESTE uautentificerede rute i hele API'et — en read-only
// delelink til familiens kalender for udenforstående (fx bedsteforældre)
// uden login. Ingen session, ingen adgang til andre ruter herfra. Se
// beslutning 5 (skrivebeskyttet, intet handlings-UI) og 6
// (rate-limiting pr. token) i 26_Sprint26_Konflikter_Delelink_Plan.md.

import { Hono } from "hono";

import type { Env } from "../env";
import { GoogleNotConnectedError } from "../lib/googleConnection";
import { fetchPublicFamilyCalendarEvents } from "../lib/googleCalendarAggregation";
import { checkRateLimit } from "../lib/rateLimit";

const publicCalendar = new Hono<{ Bindings: Env }>();

const shareLinkRateLimit = { maxAttempts: 60, windowMs: 60 * 60 * 1000 };

// Fast ±1 måned — en "hvad sker der lige nu"-visning for en udenforstående,
// ikke appens normale ±1/2 års vindue.
function getPublicCalendarRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 1);
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
}

publicCalendar.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Offentlig kalendervisning fejlede:", message);
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

interface ShareLinkRow {
  familyId: string;
  familyName: string;
  createdByUserId: string;
  includedMemberIds: string;
}

publicCalendar.get("/family-calendar/:token", async (c) => {
  const token = c.req.param("token");

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "public-family-calendar",
    key: token,
    ...shareLinkRateLimit,
  });

  if (!allowed) {
    return c.json({ error: "For mange forespørgsler. Prøv igen om lidt." }, 429);
  }

  const link = await c.env.DB.prepare(
    `SELECT fsl.family_id AS familyId, f.name AS familyName,
            fsl.created_by_user_id AS createdByUserId, fsl.included_member_ids AS includedMemberIds
     FROM family_share_links fsl
     JOIN families f ON f.id = fsl.family_id
     WHERE fsl.token = ? AND fsl.revoked_at IS NULL`,
  )
    .bind(token)
    .first<ShareLinkRow>();

  if (!link) {
    return c.json({ error: "Delelinket er ugyldigt eller er blevet deaktiveret." }, 404);
  }

  const includedMemberIds = link.includedMemberIds.split(",").filter((id) => id.length > 0);

  try {
    const events = await fetchPublicFamilyCalendarEvents(
      c.env,
      link.familyId,
      link.createdByUserId,
      includedMemberIds,
      getPublicCalendarRange(),
    );

    return c.json({ familyName: link.familyName, events });
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      return c.json(
        { error: "Kalenderen er midlertidigt utilgængelig. Prøv igen senere." },
        503,
      );
    }

    throw error;
  }
});

export default publicCalendar;
