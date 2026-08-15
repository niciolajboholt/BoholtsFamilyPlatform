import { Hono } from "hono";

import type { Env } from "./env";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/api";
import calendarRoutes from "./routes/calendar";
import familiesRoutes from "./routes/families";
import pushRoutes from "./routes/push";

const app = new Hono<{ Bindings: Env }>();

// /auth og /api svarer med engangs-/brugerspecifikt indhold (OAuth-state,
// sessions) og må aldrig caches af Cloudflares edge — sket én gang allerede:
// et tilfældigt cachet 200-svar for /auth/google/start blev serveret til
// enhver efterfølgende besøgende i stedet for et rigtigt redirect.
app.use("/auth/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.route("/auth", authRoutes);
app.route("/api", apiRoutes);
app.route("/api/families", familiesRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/push", pushRoutes);

// Beviser at Worker + D1 hænger rigtigt sammen efter en deploy (Fase 0) —
// resten af familie/kalender-ruterne kommer i senere faser.
app.get("/api/health", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

    return c.json({ status: "ok", db: row?.ok === 1 });
  } catch {
    return c.json({ status: "error", db: false }, 500);
  }
});

// Alt andet (SPA'en selv) falder igennem til de statiske filer, som
// "assets"-bindingen i wrangler.jsonc leverer.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
