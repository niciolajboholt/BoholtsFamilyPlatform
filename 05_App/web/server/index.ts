import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

// Beviser at Worker + D1 hænger rigtigt sammen efter en deploy (Fase 0) —
// selve familie/bruger/session-ruterne kommer i senere faser.
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
