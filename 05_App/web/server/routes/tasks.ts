// Sprint 23: Tiimo-inspireret opgaveløsning — engangsopgaver og faste
// rutiner, personlig (tildelt et familiemedlem) eller familie-rettet
// (assignedMemberId null). Se 23_Sprint23_Opgaver_Plan.md.
//
// Mønster og autorisation følger shoppingLists.ts: enhver familiemedlem må
// læse/skrive.

import { Hono } from "hono";

import type { Env } from "../env";
import { getSessionUser } from "../lib/session";
import { logError } from "../lib/structuredLog";
import taskRoutines from "./taskRoutes/taskRoutines";
import tasksCrud from "./taskRoutes/tasksCrud";
import type { Variables } from "./taskRoutes/taskQueries";

// server/lib/taskReminders.ts og server/lib/weeklySummary.ts importerer
// disse fra denne fil — re-eksporteret her, så deres importstier ikke
// skulle ændres ved opdelingen.
export { materializeTasksForDate, notifyForTask } from "./taskRoutes/taskQueries";

const tasks = new Hono<{ Bindings: Env; Variables: Variables }>();

tasks.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Opgave-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

tasks.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

// Ruterne er opdelt efter ansvar (se taskRoutes/) — denne fil samler dem
// blot under den fælles auth-middleware og fejlhåndtering ovenfor, samme
// mønster som families.ts og shoppingLists.ts.
tasks.route("/", tasksCrud);
tasks.route("/", taskRoutines);

export default tasks;
