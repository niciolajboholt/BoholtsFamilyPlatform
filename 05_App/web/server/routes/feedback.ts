// Sprint 30: enkel feedback-kanal fra Indstillinger — se migration 0014.
// Ikke familie-scopet (feedback hører til afsenderen, ikke en familie),
// derfor sit eget rute-modul i stedet for at ligge under /api/families
// som tasks.ts/shoppingLists.ts.

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { logError } from "../lib/structuredLog";
import { sendFeedbackNotificationEmail } from "../lib/email";
import { checkRateLimit } from "../lib/rateLimit";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };

const feedback = new Hono<{ Bindings: Env; Variables: Variables }>();

const feedbackCategories = ["idea", "bug", "other"] as const;
type FeedbackCategory = (typeof feedbackCategories)[number];

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === "string" &&
    (feedbackCategories as readonly string[]).includes(value)
  );
}

const maxMessageLength = 4000;
const maxPageLength = 300;

// Skåner både D1 og den, der senere skal læse listen, mod en spam-bølge —
// generøs nok til reel brug (ingen legitim bruger sender 20 tilbagemeldinger
// i timen).
const submitRateLimit = { maxAttempts: 20, windowMs: 60 * 60 * 1000 };

async function parseJsonBody<T extends object>(
  c: Context,
): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

feedback.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Feedback-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

feedback.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

interface SubmitFeedbackBody {
  category: string;
  message: string;
  page?: string;
}

feedback.post("/", async (c) => {
  const user = c.get("user");
  const body = await parseJsonBody<SubmitFeedbackBody>(c);

  const message = body.message?.trim() ?? "";
  const category = body.category;
  const page = body.page?.trim().slice(0, maxPageLength) || null;

  if (!message) {
    return c.json({ error: "Skriv en besked, før du sender." }, 400);
  }

  if (message.length > maxMessageLength) {
    return c.json({ error: "Beskeden er for lang." }, 400);
  }

  if (!isFeedbackCategory(category)) {
    return c.json({ error: "Vælg en kategori." }, 400);
  }

  const { allowed } = await checkRateLimit(c.env.DB, {
    scope: "feedback-submit",
    key: user.id,
    ...submitRateLimit,
  });

  if (!allowed) {
    return c.json(
      { error: "Der er sendt for meget feedback for nylig. Prøv igen senere." },
      429,
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO feedback (id, user_id, category, message, page, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      category,
      message,
      page,
      new Date().toISOString(),
    )
    .run();

  // Kører via waitUntil() — svaret sendes til klienten med det samme, uden
  // at vente på mail-leveringen, og en fejlet/langsom mail må aldrig få
  // selve indsendelsen (allerede gemt i D1 ovenfor) til at fejle.
  c.executionCtx.waitUntil(
    sendFeedbackNotificationEmail(c.env, {
      category,
      message,
      page,
      senderName: user.name,
      senderEmail: user.email,
    }).catch((error: unknown) => {
      logError("Kunne ikke sende feedback-mail", error);
    }),
  );

  return c.json({ ok: true });
});

interface FeedbackRow {
  id: string;
  category: string;
  message: string;
  page: string | null;
  createdAt: string;
  isRead: number;
  senderName: string;
  senderEmail: string;
}

// Kun ejeren (ADMIN_EMAIL) må se listen — feedback kan indeholde andre
// brugeres ord om appen, ikke noget der skal kunne læses af enhver logget
// ind bruger.
function requireAdmin(c: Context<{ Bindings: Env; Variables: Variables }>): boolean {
  return c.get("user").email === c.env.ADMIN_EMAIL;
}

feedback.get("/", async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ error: "Ikke tilladt." }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT
       feedback.id AS id,
       feedback.category AS category,
       feedback.message AS message,
       feedback.page AS page,
       feedback.created_at AS createdAt,
       feedback.is_read AS isRead,
       users.name AS senderName,
       users.email AS senderEmail
     FROM feedback
     JOIN users ON users.id = feedback.user_id
     ORDER BY feedback.created_at DESC
     LIMIT 200`,
  ).all<FeedbackRow>();

  return c.json({ feedback: results });
});

feedback.patch("/:id/read", async (c) => {
  if (!requireAdmin(c)) {
    return c.json({ error: "Ikke tilladt." }, 403);
  }

  const body = await parseJsonBody<{ isRead: boolean }>(c);
  const isRead = body.isRead !== false;

  await c.env.DB.prepare("UPDATE feedback SET is_read = ? WHERE id = ?")
    .bind(isRead ? 1 : 0, c.req.param("id"))
    .run();

  return c.json({ ok: true });
});

export default feedback;
