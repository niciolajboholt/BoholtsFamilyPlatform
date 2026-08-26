// Tynd klient for /api/push-ruterne (Sprint 21, Del A). Bruger den delte
// request()-wrapper fra src/lib/apiClient.ts — men denne fils ruter ligger
// alle under /api/push, så den delte funktion kaldes med stien
// præfikset her (den delte wrapper selv kender ikke til noget basispræfiks).

import { request } from "../../lib/apiClient";

interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

function pushRequest<T>(path: string, init?: RequestInit) {
  return request<T>(`/api/push${path}`, init);
}

export function getVapidPublicKey() {
  return pushRequest<{ publicKey: string }>("/public-key");
}

export function subscribeToPush(endpoint: string, keys: SubscriptionKeys) {
  return pushRequest<{ ok?: boolean; error?: string }>("/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint, keys }),
  });
}

export function unsubscribeFromPush(endpoint: string) {
  return pushRequest<{ ok?: boolean; error?: string }>("/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

// Verificerer fundamentet ende-til-ende (abonnement, D1, VAPID, faktisk
// levering) — sender kun til afsenderens egne devices. Midlertidig UI-knap,
// fjernes igen når kalender/indkøbsliste er koblet til rigtige hændelser.
export function sendTestPushNotification() {
  return pushRequest<{ ok?: boolean; error?: string }>("/test", { method: "POST" });
}
