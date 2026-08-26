// Sprint 21, Del A: abonnements-håndtering for Web Push. Selve
// afsendelsen (og familie-udsendelsen) ligger i lib/pushNotifications.ts —
// denne fil håndterer kun klientens abonner/afmeld-flow og et
// selvtest-endpoint til at verificere fundamentet isoleret, før det kobles
// til rigtige hændelser (kalender, indkøbsliste).

import type { Context } from "hono";
import { Hono } from "hono";

import type { Env } from "../env";
import { logError } from "../lib/structuredLog";
import { sendPushNotificationToUser } from "../lib/pushNotifications";
import { getSessionUser, type SessionUser } from "../lib/session";

type Variables = { user: SessionUser };
const push = new Hono<{ Bindings: Env; Variables: Variables }>();

async function parseJsonBody<T extends object>(
  c: Context,
): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}) as Partial<T>);
}

push.onError((error, c) => {
  const message = error instanceof Error ? error.message : String(error);
  logError("Push-API fejlede", message, { path: c.req.path });
  return c.json({ error: "Der skete en serverfejl. Prøv igen." }, 500);
});

push.use("*", async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    return c.json({ error: "Ikke logget ind." }, 401);
  }

  c.set("user", user);
  await next();
});

// Ikke-hemmelig — klienten skal kende den for at kunne abonnere via
// PushManager.subscribe({ applicationServerKey }). Hentes fra serveren i
// stedet for at duplikere den i en build-time env-var, så der kun er ét
// sted den kan komme ud af sync.
push.get("/public-key", (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY }));

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Sprint 29: uden dette accepterede /subscribe et vilkårligt endpoint —
// pushNotifications.ts's sendPushNotification() fetcher det direkte, når
// en push senere afsendes, så enhver logget bruger kunne reelt få
// Workeren til selv at sende signerede, udgående POST-kald til en
// hvilken som helst URL (en reel SSRF-vej). Bevidst en bred, men ikke
// ligegyldig regel (kræv https, afvis lokale/private hosts) frem for en
// snæver liste over kendte push-tjenester, som risikerer at afvise en
// legitim browser/push-tjeneste, vi ikke kender til.
function isPlausiblePushEndpoint(endpoint: string): boolean {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1") {
    return false;
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);

  if (ipv4Match) {
    const firstOctet = Number(ipv4Match[1]);
    const secondOctet = Number(ipv4Match[2]);
    const isPrivateOrLoopback =
      firstOctet === 10 ||
      firstOctet === 127 ||
      (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
      (firstOctet === 192 && secondOctet === 168) ||
      (firstOctet === 169 && secondOctet === 254);

    if (isPrivateOrLoopback) {
      return false;
    }
  }

  return true;
}

push.post("/subscribe", async (c) => {
  const body = await parseJsonBody<SubscribeBody>(c);

  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return c.json({ error: "Ugyldigt abonnement." }, 400);
  }

  if (!isPlausiblePushEndpoint(body.endpoint)) {
    return c.json({ error: "Ugyldigt abonnement." }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_id = excluded.user_id,
       p256dh_key = excluded.p256dh_key,
       auth_key = excluded.auth_key`,
  )
    .bind(
      crypto.randomUUID(),
      c.get("user").id,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
      new Date().toISOString(),
    )
    .run();

  return c.json({ ok: true });
});

push.delete("/subscribe", async (c) => {
  const body = await parseJsonBody<{ endpoint: string }>(c);

  if (!body.endpoint) {
    return c.json({ error: "endpoint er påkrævet." }, 400);
  }

  await c.env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
  )
    .bind(body.endpoint, c.get("user").id)
    .run();

  return c.json({ ok: true });
});

// Verificerer fundamentet (VAPID-nøgler, kryptering, faktisk levering) i
// isolation — sender kun til afsenderens egne devices, ingen
// familie-involvering. Bruges manuelt under udrulning, ikke af klient-UI.
push.post("/test", async (c) => {
  await sendPushNotificationToUser(c.env, c.get("user").id, {
    title: "Test-notifikation",
    body: "Push-notifikationer virker.",
  });

  return c.json({ ok: true });
});

export default push;
