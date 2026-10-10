/*
 * billsplit service worker – only for push notifications. It does not cache anything (no fetch
 * handler), so new versions of the app arrive exactly as before.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let notice = {};
  try {
    notice = event.data ? event.data.json() : {};
  } catch {
    notice = { body: event.data ? event.data.text() : "" };
  }
  // iOS requires every push to show a notification.
  event.waitUntil(
    self.registration.showNotification(notice.title || "billsplit", {
      body: notice.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "de",
      data: { path: notice.path || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // The app is open: bring it to the front and let it go there.
      for (const client of windows) {
        if ("focus" in client) {
          client.postMessage({ type: "billsplit:navigate", path });
          return client.focus();
        }
      }
      return self.clients.openWindow(`/#${path}`);
    }),
  );
});
