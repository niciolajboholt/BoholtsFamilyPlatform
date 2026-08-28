// Sprint 21, Del B: familiens delte indkøbsliste(r). Mønster og
// autorisation følger families.ts's calendar-mappings-ruter — enhver
// familiemedlem må læse/skrive (indkøb er en fælles, uformel aktivitet, i
// modsætning til kalender-tildeling og medlemsadministration, som kræver
// ejer/admin).

import { Hono } from "hono";

import type { Env } from "../env";
import { getSessionUser } from "../lib/session";
import { logError } from "../lib/structuredLog";
import items from "./shoppingListRoutes/items";
import lists from "./shoppingListRoutes/lists";
import type { Variables } from "./shoppingListRoutes/shoppingListQueries";
import templates from "./shoppingListRoutes/templates";

const shoppingLists = new Hono<{ Bindings: Env; Variables: Variables }>();

shoppingLists.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Indkøbsliste-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

shoppingLists.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

// Ruterne er opdelt efter ansvar (se shoppingListRoutes/) — denne fil
// samler dem blot under den fælles auth-middleware og fejlhåndtering
// ovenfor, samme mønster som families.ts.
shoppingLists.route("/", lists);
shoppingLists.route("/", items);
shoppingLists.route("/", templates);

export default shoppingLists;
