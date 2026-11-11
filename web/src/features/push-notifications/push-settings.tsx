"use client";

import { useEffect, useState } from "react";
import { getPushSchedule, removePushSubscription, savePushSubscription } from "./actions";

function decodeApplicationServerKey(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function needsInstalledAppleApp() {
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isAppleMobile && !window.matchMedia("(display-mode: standalone)").matches;
}

export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | "checking">(
    "checking",
  );
  const [dailyTime, setDailyTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (
          !("Notification" in window) ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window)
        ) {
          if (active) setPermission("unsupported");
          return null;
        }
        setPermission(Notification.permission);
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        return navigator.serviceWorker.register("/push-service-worker.js", { scope: "/push/" });
      })
      .then(async (serviceWorker) => {
        if (!active || !serviceWorker) return;
        setRegistration(serviceWorker);
        const existingSubscription = await serviceWorker.pushManager.getSubscription();
        if (!active) return;
        setSubscription(existingSubscription);
        if (!existingSubscription) return;

        const result = await getPushSchedule({ endpoint: existingSubscription.endpoint });
        if (!active) return;
        if (result.error) {
          setError(result.error);
        } else if (result.schedule) {
          setDailyTime(result.schedule.dailyCheckinTime);
          setTimezone(result.schedule.timezone);
        }
      })
      .catch((registrationError: unknown) => {
        console.error("Jarvis could not register its push service worker.", registrationError);
        if (active) setError("Push notifications could not be initialized in this browser.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function enableNotifications() {
    if (!publicKey || !registration) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = permission === "default" ? await Notification.requestPermission() : permission;
      setPermission(result);
      if (result !== "granted") {
        setError(
          result === "denied"
            ? "Notifications are blocked in browser settings. Allow them there, then try again."
            : "Notification permission was not granted.",
        );
        return;
      }

      const currentSubscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(publicKey),
        }));
      const resultFromServer = await savePushSubscription({
        ...currentSubscription.toJSON(),
        dailyCheckinTime: dailyTime,
        timezone,
      });
      if (resultFromServer.error) {
        if (!subscription) await currentSubscription.unsubscribe();
        setError(resultFromServer.error);
        return;
      }

      setSubscription(currentSubscription);
      setMessage("Daily check-in notifications are enabled for this device.");
    } catch (notificationError) {
      console.error("Jarvis could not enable push notifications.", notificationError);
      setError(
        needsInstalledAppleApp()
          ? "On iPhone or iPad, add Jarvis to your home screen and open the installed app before enabling notifications."
          : "Could not enable push notifications. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await savePushSubscription({
        ...subscription.toJSON(),
        dailyCheckinTime: dailyTime,
        timezone,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Your daily check-in time has been saved.");
    } catch (scheduleError) {
      console.error("Jarvis could not save the push schedule.", scheduleError);
      setError("Could not update the reminder time. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!subscription) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await removePushSubscription({ endpoint: subscription.endpoint });
      if (result.error) {
        setError(result.error);
        return;
      }
      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) {
        console.error("The browser did not confirm push unsubscription.");
      }
      setSubscription(null);
      setMessage(
        unsubscribed
          ? "Daily check-in notifications are turned off for this device."
          : "Jarvis will stop sending notifications, but this browser may still show them as enabled.",
      );
    } catch (unsubscribeError) {
      console.error("Jarvis could not turn off push notifications.", unsubscribeError);
      setError("Could not turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canEnable =
    publicKey !== null &&
    registration !== null &&
    permission !== "unsupported" &&
    permission !== "denied";

  return (
    <section className="feature-card" id="notifications">
      <div className="section-title">
        <div>
          <p className="eyebrow">04 · Notifications</p>
          <h2>Daily job-search check-in</h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Choose a local time for a daily reminder. Jarvis only asks for permission when you enable
        notifications; you can turn them off for this device at any time.
      </p>
      {permission === "unsupported" && (
        <p className="form-error mt-4" role="status">
          This browser does not support web push notifications. On iPhone or iPad, install Jarvis to
          the home screen and open the installed app first.
        </p>
      )}
      {!publicKey && (
        <p className="setup-notice mt-4">
          Push notifications are not configured yet. Add the public VAPID key to the web app
          environment to enable them.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="field-label w-full max-w-56">
          Reminder time ({timezone})
          <input
            className="form-input"
            disabled={busy}
            onChange={(event) => setDailyTime(event.target.value)}
            type="time"
            value={dailyTime}
          />
        </label>
        {subscription ? (
          <>
            <button
              className="button-secondary"
              disabled={busy}
              onClick={saveSchedule}
              type="button"
            >
              Save reminder time
            </button>
            <button
              className="button-danger"
              disabled={busy}
              onClick={disableNotifications}
              type="button"
            >
              Turn off on this device
            </button>
          </>
        ) : (
          <button
            className="button-primary"
            disabled={busy || !canEnable}
            onClick={enableNotifications}
            type="button"
          >
            {busy ? "Working..." : "Enable daily check-in"}
          </button>
        )}
      </div>
      {error && (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-notice mt-4" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
