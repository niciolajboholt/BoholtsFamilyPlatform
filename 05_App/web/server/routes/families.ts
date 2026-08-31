import { Hono } from "hono";

import type { Env } from "../env";
import { getSessionUser } from "../lib/session";
import { logError } from "../lib/structuredLog";
import calendarMappings from "./familyRoutes/calendarMappings";
import familyCore from "./familyRoutes/familyCore";
import familyMembers from "./familyRoutes/familyMembers";
import familySettings from "./familyRoutes/familySettings";
import type { Variables } from "./familyRoutes/familyQueries";
import icsSubscriptions from "./familyRoutes/icsSubscriptions";
import shareLinks from "./familyRoutes/shareLinks";

const families = new Hono<{ Bindings: Env; Variables: Variables }>();

// Uden dette viser Cloudflares logs kun et stack-trace uden selve
// fejlbeskeden for uventede (ufangede) fejl, fx D1-fejl — samme problem vi
// stødte på i auth.ts's callback, før den fik sin egen try/catch.
families.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Familie-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

// Enhver /api/families*-rute kræver en gyldig session — der er ingen
// offentlige familie-data.
families.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

// Ruterne er opdelt efter ansvar (se features/../familyRoutes) — denne fil
// samler dem blot under den fælles auth-middleware og fejlhåndtering
// ovenfor. Rækkefølgen har ingen betydning: ingen af underrutternes stier
// overlapper i form.
families.route("/", familyCore);
families.route("/", familyMembers);
families.route("/", shareLinks);
families.route("/", familySettings);
families.route("/", calendarMappings);
families.route("/", icsSubscriptions);

export default families;
