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

// Sprint 29: rate limit'et var hidtil nøglet kun på token — én besøgende
// kunne opbruge hele linkets kvote for alle andre, der kigger på samme
// delelink. Nøgles nu på token+IP (pr. besøgende) som primær grænse, med
// en grovere per-token-grænse som sikkerhedsnet mod fx tusindvis af
// forespørgsler fra mange forskellige IP'er mod samme link.
const shareLinkPerVisitorRateLimit = { maxAttempts: 30, windowMs: 60 * 60 * 1000 };
const shareLinkPerTokenRateLimit = { maxAttempts: 300, windowMs: 60 * 60 * 1000 };

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
  includeDescription: number;
  includeLocation: number;
}

publicCalendar.get("/family-calendar/:token", async (c) => {
  const token = c.req.param("token");
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";

  const [{ allowed: allowedForToken }, { allowed: allowedForVisitor }] = await Promise.all([
    checkRateLimit(c.env.DB, {
      scope: "public-family-calendar",
      key: token,
      ...shareLinkPerTokenRateLimit,
    }),
    checkRateLimit(c.env.DB, {
      scope: "public-family-calendar-visitor",
      key: `${token}:${clientIp}`,
      ...shareLinkPerVisitorRateLimit,
    }),
  ]);

  if (!allowedForToken || !allowedForVisitor) {
    return c.json({ error: "For mange forespørgsler. Prøv igen om lidt." }, 429);
  }

  const link = await c.env.DB.prepare(
    `SELECT fsl.family_id AS familyId, f.name AS familyName,
            fsl.created_by_user_id AS createdByUserId, fsl.included_member_ids AS includedMemberIds,
            fsl.include_description AS includeDescription, fsl.include_location AS includeLocation
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

    // Beskrivelse/lokation er tilvalg, slået fra som standard (Sprint 29)
    // — en aftales fritekstindhold kan indeholde langt mere følsomt end
    // titel/tidspunkt, som er selve pointen med et delelink.
    const filteredEvents = events.map((event) => ({
      ...event,
      description: link.includeDescription ? event.description : undefined,
      location: link.includeLocation ? event.location : undefined,
    }));

    return c.json({ familyName: link.familyName, events: filteredEvents });
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
