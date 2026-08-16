// Sprint 21, Del A: browser-siden af push-abonnementet — beder om
// tilladelse, registrerer hos PushManager, og sender resultatet til
// serveren. UI-laget (usePushNotifications) kalder kun disse funktioner,
// aldrig PushManager direkte.

import { getVapidPublicKey, subscribeToPush, unsubscribeFromPush } from "./notificationsApi";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// PushManager.subscribe() kræver den offentlige VAPID-nøgle som rå bytes
// (Uint8Array), ikke som den base64url-streng serveren og wrangler.jsonc
// bruger.
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

function subscriptionToKeys(subscription: PushSubscription): {
  p256dh: string;
  auth: string;
} {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error("Push-abonnementet mangler krypteringsnøgler.");
  }

  return { p256dh, auth };
}

/**
 * Beder om notifikations-tilladelse (kan kun ske som reaktion på en
 * brugerhandling, fx et klik — browsere ignorerer/afviser kaldet ellers),
 * registrerer hos PushManager, og gemmer abonnementet på serveren.
 */
export async function enablePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Denne browser understøtter ikke push-notifikationer.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifikations-tilladelse blev ikke givet.");
  }

  const keyResult = await getVapidPublicKey();
  if (!keyResult.ok || !keyResult.data.publicKey) {
    throw new Error("Kunne ikke hente push-nøgle fra serveren.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyResult.data.publicKey),
  });

  const result = await subscribeToPush(subscription.endpoint, subscriptionToKeys(subscription));
  if (!result.ok) {
    // Abonnementet blev oprettet i browseren, men ikke gemt på serveren —
    // ryd op igen, så vi ikke efterlader et "halvt" abonnement, appen tror
    // er aktivt.
    await subscription.unsubscribe();
    throw new Error("Kunne ikke gemme push-abonnementet på serveren.");
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  await unsubscribeFromPush(subscription.endpoint);
  await subscription.unsubscribe();
}

export async function getPushSubscriptionStatus(): Promise<
  "unsupported" | "denied" | "subscribed" | "not-subscribed"
> {
  if (!isPushSupported()) {
    return "unsupported";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return subscription ? "subscribed" : "not-subscribed";
}
