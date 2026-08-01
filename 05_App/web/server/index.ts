import { Hono } from "hono";

import type { Env } from "./env";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.route("/auth", authRoutes);
app.route("/api", apiRoutes);

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
