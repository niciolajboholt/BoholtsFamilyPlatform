/// <reference lib="webworker" />
// Sprint 21, Del A: skiftet fra vite-plugin-pwa's generateSW til
// injectManifest — generateSW kan ikke tilføje egne "push"/
// "notificationclick"-lyttere, kun konfigurere caching. self.__WB_MANIFEST
// erstattes af Vite ved build med den samme precache-liste som før.

import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Samme undtagelse som den tidligere navigateFallbackDenylist: /auth og
// /api er ikke SPA-sider — uden denne fanger navigations-fallbacket også
// et klik på "Log ind med Google" og server den cachede index.html i
// stedet for at lade browseren ramme den rigtige /auth/google/start-rute.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/auth\//, /^\/api\//],
  }),
);

// registerType "autoUpdate" (se vite.config.ts) forventer selv at styre
// opdateringen — uden disse to aktiveres den nye service worker først ved
// NÆSTE sideindlæsning, ikke den indeværende.
self.skipWaiting();
self.addEventListener("activate", () => {
  void self.clients.claim();
});

// --- Push-notifikationer (Sprint 21, Del A) ---

interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload: PushNotificationPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration
      .showNotification(payload.title, {
        body: payload.body,
        data: { url: payload.url ?? "/" },
      })
      // iOS Safaris Web Push-understøttelse har haft problemer med at vise
      // notifikationer, der har et SVG-ikon (fjernet ovenfor af samme
      // grund) — men falder showNotification() alligevel af en anden
      // årsag, er et helt bart forsøg bedre end at pushen forsvinder
      // sporløst, uden at brugeren nogensinde ser den.
      .catch(() => self.registration.showNotification(payload.title)),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window" });
      const existing = clientsList.find((client) => "focus" in client);

      if (existing) {
        await (existing as WindowClient).focus();
        return;
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
