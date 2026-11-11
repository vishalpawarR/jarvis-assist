"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch((error: unknown) => {
        console.error("Jarvis could not register its offline service worker.", error);
      });
  }, []);

  return null;
}
