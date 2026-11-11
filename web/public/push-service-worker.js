self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      console.error("Jarvis received an invalid push notification payload.", error);
    }
  }

  const title = typeof payload.title === "string" ? payload.title : "Jarvis job-search check-in";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "Take a moment to review your job-search progress.";
  const path =
    typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
      ? payload.url
      : "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "jarvis-daily-checkin",
      data: { path },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  const target =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
      ? new URL(path, self.location.origin)
      : new URL("/dashboard", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const appClient = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (appClient) {
        return appClient.navigate(target.href).then((windowClient) => windowClient?.focus());
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
