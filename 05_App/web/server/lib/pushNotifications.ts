// Sprint 21, Del A: sender Web Push (VAPID)-notifikationer til familiens
// medlemmer. Bruges af kalender-ruterne (ny/redigeret/slettet aftale) og
// senere indkøbslisten (Del B) — ét fælles sted, så begge features deler
// samme afsendelses- og oprydningslogik i stedet for hver sin kopi.

import { deserializeVapidKeys, sendPushNotification } from "web-push-browser";

import type { Env } from "../env";

export interface PushNotificationPayload {
  title: string;
  body: string;
  // Sti appen skal åbne på, når brugeren trykker på notifikationen (fx
  // "/calendar" eller "/shopping-list") — håndteres af service workerens
  // "notificationclick"-handler, ikke af denne fil.
  url?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

async function getVapidKeys(env: Env) {
  return deserializeVapidKeys({
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: await env.VAPID_PRIVATE_KEY.get(),
  });
}

// web-push-browsers sendPushNotification() tager en BAR e-mail som sit
// "email"-argument og sætter selv "mailto:" foran, når den bygger JWT'ens
// sub-claim (se dens createJWT: `mailto:${email}`) — men VAPID_SUBJECT er
// bevidst en fuld "mailto:"-URI (spec-korrekt, ADR/env-dokumentationen), så
// uden dette blev claimet dobbelt-præfikset ("mailto:mailto:...").
// Windows/WNS validerede det tilsyneladende ikke strengt, men Apples
// web.push.apple.com afviste det som "BadJwtToken" — deraf kun fejl på iOS.
function toBareEmail(vapidSubject: string): string {
  return vapidSubject.replace(/^mailto:/, "");
}

/**
 * Sender til alle af én brugers registrerede devices. En 404/410 fra
 * push-tjenesten betyder abonnementet er udløbet eller tilbagekaldt af
 * brugeren (fx afinstalleret appen) — sådan et rydes automatisk op, i
 * stedet for at blive ved med at fejle ved hvert forsøg fremover.
 */
export async function sendPushNotificationToUser(
  env: Env,
  userId: string,
  payload: PushNotificationPayload,
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT id, endpoint, p256dh_key AS p256dhKey, auth_key AS authKey FROM push_subscriptions WHERE user_id = ?",
  )
    .bind(userId)
    .all<SubscriptionRow>();

  if (results.length === 0) {
    return;
  }

  const vapidKeys = await getVapidKeys(env);
  const serializedPayload = JSON.stringify(payload);

  await Promise.all(
    results.map(async (row) => {
      try {
        const response = await sendPushNotification(
          vapidKeys,
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dhKey, auth: row.authKey },
          },
          toBareEmail(env.VAPID_SUBJECT),
          serializedPayload,
        );

        if (response.status === 404 || response.status === 410) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
            .bind(row.id)
            .run();
        } else if (!response.ok) {
          // fetch() kaster kun ved netværksfejl, aldrig ved en HTTP-fejlstatus
          // — en push-tjeneste, der afviser med fx 400/401/413, ville derfor
          // ellers passere helt ubemærket herfra: hverken logget som fejl,
          // eller ryddet op som en udløbet 404/410-subscription.
          const body = await response.text().catch(() => "");
          console.error(
            `Push-notifikation afvist af push-tjenesten (status ${response.status}):`,
            body,
          );
        }
      } catch (error: unknown) {
        // Ét devices fejlende push (netværksfejl, ugyldigt endpoint) må
        // ikke afbryde afsendelsen til familiens øvrige devices.
        console.error("Push-notifikation fejlede:", error);
      }
    }),
  );
}

/**
 * Sender til alle familiens medlemmer undtagen den, der udløste hændelsen —
 * man skal ikke have en notifikation om sin egen handling.
 */
export async function sendPushNotificationToFamily(
  env: Env,
  familyId: string,
  excludeUserId: string,
  payload: PushNotificationPayload,
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT user_id AS userId FROM family_memberships WHERE family_id = ? AND user_id != ?",
  )
    .bind(familyId, excludeUserId)
    .all<{ userId: string }>();

  await Promise.all(
    results.map((row) => sendPushNotificationToUser(env, row.userId, payload)),
  );
}
