// Tynd klient for /api/push-ruterne (Sprint 21, Del A). Samme mønster som
// familyApi.ts's request()-wrapper.

interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(`/api/push${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const data = (await response.json().catch(() => ({}))) as T;

  return { ok: response.ok, status: response.status, data };
}

export function getVapidPublicKey() {
  return request<{ publicKey: string }>("/public-key");
}

export function subscribeToPush(endpoint: string, keys: SubscriptionKeys) {
  return request<{ ok?: boolean; error?: string }>("/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint, keys }),
  });
}

export function unsubscribeFromPush(endpoint: string) {
  return request<{ ok?: boolean; error?: string }>("/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

// Verificerer fundamentet ende-til-ende (abonnement, D1, VAPID, faktisk
// levering) — sender kun til afsenderens egne devices. Midlertidig UI-knap,
// fjernes igen når kalender/indkøbsliste er koblet til rigtige hændelser.
export function sendTestPushNotification() {
  return request<{ ok?: boolean; error?: string }>("/test", { method: "POST" });
}
