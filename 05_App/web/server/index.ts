import { Hono } from "hono";

import type { Env } from "./env";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/api";
import calendarRoutes from "./routes/calendar";
import eventRemindersRoutes from "./routes/eventReminders";
import feedbackRoutes from "./routes/feedback";
import familiesRoutes from "./routes/families";
import publicCalendarRoutes from "./routes/publicCalendar";
import pushRoutes from "./routes/push";
import shoppingListsRoutes from "./routes/shoppingLists";
import tasksRoutes from "./routes/tasks";
import { sendDueEventReminders } from "./lib/eventReminders";
import { cleanupOldRateLimitAttempts } from "./lib/rateLimit";
import { checkSchema } from "./lib/schemaCheck";
import { cleanupExpiredSessions } from "./lib/session";
import { sendDueTaskReminders } from "./lib/taskReminders";
import { sendWeeklySummaries } from "./lib/weeklySummary";

const app = new Hono<{ Bindings: Env }>();

// Sprint 29: ingen sikkerhedsheaders var sat overhovedet. Bevidst en
// konservativ, samme-origin-only politik — appen har ingen tredjeparts-
// scripts/stylesheets/fonts (se index.html), og Google/MSAL-login sker
// via en fuld side-navigation (window.location), ikke fetch/iframe, så
// CSP begrænser den slags overhovedet ikke.
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      // 'unsafe-inline' er nødvendigt for MUI/Emotion's runtime
      // style-injektion — ikke en scriptrisiko, kun CSS.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
});

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
app.route("/api/families", shoppingListsRoutes);
app.route("/api/families", tasksRoutes);
app.route("/api/families", eventRemindersRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/push", pushRoutes);
app.route("/api/feedback", feedbackRoutes);
// Sprint 26: bevidst UDEN FOR /api/families's session-krav — se
// publicCalendar.ts's egen kommentar. Eneste uautentificerede API-rute.
app.route("/api/public", publicCalendarRoutes);

// Beviser at Worker + D1 hænger rigtigt sammen efter en deploy (Fase 0) —
// resten af familie/kalender-ruterne kommer i senere faser.
// Sprint 29: udvidet med et migrations-tjek (checkSchema()) — erstatter
// den tidligere manuelle "SELECT name FROM sqlite_master"-verifikation
// efter en migration med ét kald, der gør en mismatch synlig med det
// samme.
app.get("/api/health", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    const migrations = await checkSchema(c.env.DB);

    return c.json({
      status: "ok",
      db: row?.ok === 1,
      migrations,
      version: c.env.CF_VERSION_METADATA,
    });
  } catch {
    return c.json({ status: "error", db: false }, 500);
  }
});

// Sprint 29: en ukendt /api/*-sti faldt hidtil igennem til SPA-fallbacket
// nedenfor og fik appens index.html med 200, i stedet for en rigtig
// 404 — placeret efter alle rigtige /api/*-ruter ovenfor, så kun reelt
// uregistrerede stier rammer den.
app.all("/api/*", (c) => c.json({ error: "Ikke fundet." }, 404));

// Alt andet (SPA'en selv) falder igennem til de statiske filer, som
// "assets"-bindingen i wrangler.jsonc leverer.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  // Tre Cron Triggers (se wrangler.jsonc's "triggers"), adskilt på
  // controller.cron: den daglige (Sprint 24) rydder udløbne sessioner og
  // gamle rate-limit-forsøg op; hvert 5. minut (Sprint 27, udvidet Sprint 31)
  // sender tidsbaserede opgave- OG aftale-påmindelser; ugentligt søndag
  // (Sprint 28) sender et AI-genereret ugeresumé.
  //
  // Aftale-påmindelser er bevidst lagt på det EKSISTERENDE 5-minutters-tick
  // frem for en ny cron-trigger — kontoen har et loft på 5 cron-triggers i
  // alt på tværs af alle Workers/miljøer (se wrangler.jsonc's kommentar),
  // som allerede er i brug.
  async scheduled(controller, env, ctx) {
    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(sendDueTaskReminders(env));
      ctx.waitUntil(sendDueEventReminders(env));
      return;
    }

    if (controller.cron === "0 17 * * SUN") {
      ctx.waitUntil(sendWeeklySummaries(env));
      return;
    }

    ctx.waitUntil(cleanupExpiredSessions(env));
    ctx.waitUntil(cleanupOldRateLimitAttempts(env.DB));
  },
} satisfies ExportedHandler<Env>;
