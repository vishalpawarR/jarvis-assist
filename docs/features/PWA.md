# PWA, notifications, and mobile widgets

This is the feature-by-feature planner for bringing Jarvis Web closer to a
mobile app. Work in small commits; do not imply that a browser capability is
available until it is implemented and tested on target devices.

## Feasibility

| Capability                                              | Feasibility                              | Notes                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install Jarvis Web as an app                            | **Possible**                             | Add a valid manifest, correctly sized icons, and serve the deployed site over HTTPS. Installation UI and browser requirements vary by platform.                                                                                        |
| Basic offline experience                                | **Possible, limited**                    | Cache a public offline page and app icons only. Do not cache authenticated dashboard HTML, private records, or API responses in this initial version. Editing and syncing still require a network connection.                          |
| Ask for notification permission                         | **Possible, user-initiated**             | The user must click a clear opt-in control. Do not request permission on page load or just because the app was installed.                                                                                                              |
| Notify the user automatically when the app is installed | **Not reliably supported**               | Browsers do not provide a consistent install event or permission to send a notification on install. Show an optional welcome/onboarding prompt on a later visit instead.                                                               |
| Browser-local notifications while the page is open      | **Possible, limited**                    | Can notify only while the app is active and permission is granted; not a dependable scheduled reminder.                                                                                                                                |
| Remote Web Push while the app is closed                 | **Possible, with backend work**          | Requires a service worker, user consent, VAPID keys, secure subscription storage, an authenticated sender (for example a Supabase Edge Function), unsubscribe handling, and delivery/error monitoring. Browser and OS support differs. |
| Native Android/iOS home-screen widgets                  | **Not supported by a website/PWA alone** | Widgets require a native app/OS extension. A responsive dashboard or home-screen shortcut is possible, but it is not a widget. A native wrapper/app would be a separate project.                                                       |

Never put a VAPID private key or other server secret in browser code. Push
payloads should avoid personal details and resume contents.

## Feature sequence

### 1. Installable PWA and safe offline fallback

- [x] Add app manifest, install icons, theme color, and mobile metadata.
- [x] Register a small service worker in production.
- [x] Cache only the static offline page and app icons; never cache private
      pages or API responses.
- [x] Verify manifest and offline navigation in a production build on localhost.
- [ ] Verify browser installation on an HTTPS deployment and target mobile devices.

### 2. Install guidance and permission onboarding

- [ ] Explain browser-specific install steps when no install prompt is
      available (notably iOS Safari).
- [x] Add an explicit opt-in control for daily job-search check-ins, with a
      configurable local time and a way to turn notifications off per device.
- [x] Ask for notification permission only after the user enables check-ins.

### 3. Reliable remote push notifications

- [x] Choose the first trigger: one daily job-search check-in per opted-in
      device, at the user's local time.
- [x] Add authenticated subscription storage with ownership/RLS and per-device
      unsubscribe.
- [ ] Add a server-side sender and VAPID secret configuration; never send
      arbitrary notifications from an unauthenticated client.
- [ ] Test permission denial, subscription renewal, unsubscribe, delivery
      failures, and target browser/OS support.

### 4. Mobile widgets decision

- [ ] Keep the responsive PWA dashboard as the web-only option.
- [ ] If native widgets are still required, evaluate a separate native Android
      and iOS app or wrapper; define data access and security before building.

## Decisions and status

- Start with Feature 1; keep authenticated data online-only and uncached.
- Notification prompts are opt-in and user initiated, never coupled to app
  installation.
- Native widgets are outside the web-only scope.
- Feature 1 implementation: manifest and icons are in place; the service worker
  only caches the static offline document and icons, and falls back to the
  offline document for failed same-origin navigations. Authentication and
  dashboard data are never cached. A production browser check confirmed the
  manifest and service worker load, and an offline dashboard navigation shows
  the offline page. Installation on deployed HTTPS and target devices remains
  to be verified.
- Push preference UI now requests permission only from the user's button click,
  stores one device subscription per authenticated user, and supports a daily
  local-time schedule. Delivery is not active until the server-side scheduler
  and VAPID secrets are configured.
- Current live push delivery and widget support: **not implemented**.
