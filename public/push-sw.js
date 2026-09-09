/* Mithra push notifications service worker (messaging only, no app caching) */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "مثراء", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "مثراء العقارية";
  const options = {
    body: payload.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: payload.tag || "mithra",
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200, 100, 300],
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
