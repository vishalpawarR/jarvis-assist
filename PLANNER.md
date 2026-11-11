# Jarvis website, installable app, and data-sync plan

## Goal

Build a Jarvis website that can be installed from the browser as an app and
shares the user's tracked job sites, saved pages, personal details, and
optionally their resume with the existing Chrome/Edge extension. Changes made
in either place should show up in the other, including when one device was
offline.

## Current starting point

The extension currently keeps:

- Tracked sites in `chrome.storage.local` under `jarvisTrackedSites`.
- Saved pages in `chrome.storage.local` under `jarvisSavedPages`.
- Personal information in `chrome.storage.local` under `jarvisPersonalInfo`.
- The chosen resume PDF in extension-origin IndexedDB (`jarvisResume`).

The current extension has no account, server API, or synchronization. The
website and extension therefore need a shared account and a deliberate
migration/sync flow; they cannot share browser-local storage directly.

## Suggested stack and database

### Recommendation: Supabase (PostgreSQL)

For this project, Supabase is a practical and relatively easy hosted option:

- PostgreSQL gives the data a clear structure and makes backups and future
  reporting straightforward.
- Supabase Auth avoids building password storage and account recovery from
  scratch.
- Row Level Security (RLS) can enforce that every user only reads and changes
  their own records.
- Supabase Storage can hold a private resume file if cross-device resume sync
  is explicitly enabled.
- The web client and extension can use the same authenticated API.

Use the Supabase client SDK through HTTPS and rely on RLS for user-scoped
access. The publishable/anon key may be in client code; never put the
service-role key in the website or extension. Keep schema changes in versioned
SQL migrations.

**Alternative:** Firebase is also easy to start with and offers authentication
and realtime document sync. Prefer it if realtime/offline document sync is
the top priority and the team is comfortable with a NoSQL data model.

**Self-hosted alternative:** PostgreSQL plus an API (for example, a small
Node.js service) provides more control, but requires implementing and
maintaining authentication, authorization, backups, deployment, and file
storage. It is not the easiest first release.

## Proposed data model

Use stable UUIDs for client-created records so offline changes can be queued
and retried safely.

- `profiles`: `user_id` (auth user ID, primary key), profile preferences,
  `created_at`, `updated_at`.
- `personal_info`: `user_id` (primary key), name, email, phone, location,
  LinkedIn URL, `updated_at`.
- `notification_preferences`: `user_id`, enabled, selected notification
  categories, timezone, quiet-hours schedule, optional office-hours schedule,
  optional office geofence configuration, `updated_at`.
- `notification_state`: `user_id`, current office status
  (`in_office`/`not_in_office`/`unknown`), status source
  (`manual`/`schedule`/`location`), expiry time, `updated_at`.
- `tracked_sites`: `id`, `user_id`, hostname, label, URL, last title,
  last-visited time, `created_at`, `updated_at`, optional `deleted_at`.
- `saved_pages`: `id`, `user_id`, title, URL, selected text, `saved_at`,
  `updated_at`, optional `deleted_at`.
- `sync_changes` (only if needed): user ID, record type/ID, operation,
  server sequence or version, and timestamps for change-feed or diagnostics.
- Private Storage object for a resume, keyed by user ID, only if resume sync is
  enabled.

Create indexes on `user_id` and frequently searched fields. Enable RLS on
every user-data table and Storage bucket; policies must scope reads, writes,
updates, and deletes to the authenticated user. Never trust a client-supplied
`user_id` without checking it against the authenticated session.

## Two-way synchronization design

1. **Keep local-first behavior.** The extension and website remain usable
   offline. Local edits are saved immediately and marked pending.
2. **Add account sign-in.** Both clients sign in to the same account. Do not
   upload anything until the user signs in and explicitly opts in to sync.
3. **Initial sync.** After consent, upload local records with stable IDs,
   download records for the account, and show a preview/count before any
   potentially destructive merge.
4. **Incremental sync.** Push pending creates/edits/deletes and pull remote
   changes at startup, after sign-in, when the network returns, and after a
   successful edit. Use retries with backoff and idempotent upserts.
5. **Represent deletions.** Use tombstones (`deleted_at`) until all clients
   have had a chance to sync, so a deleted item does not reappear from an
   offline device.
6. **Resolve concurrent edits.** Add a server-managed version or `updated_at`
   to records. Start by detecting when both local and remote versions changed
   since the last sync; show the user both versions and let them choose. Avoid
   silently overwriting personal details or saved text. A documented
   last-write-wins policy can be a later opt-in for low-risk fields.
7. **Protect credentials.** Use the provider's supported browser-extension
   sign-in flow and store only the minimum session data in extension storage.
   Handle refresh, sign-out, revoked access, and extension uninstall/reinstall.
8. **Expose sync state.** Show “Local only”, “Syncing”, “Synced”, or “Needs
   attention” and provide retry, pause-sync, sign-out, export, and delete
   account-data controls.

## Website and installable app

Implement a responsive web app that works on mobile and desktop, then make it
a Progressive Web App (PWA):

- Add a web app manifest with app name, icons, theme colors, start URL, and
  standalone display mode.
- Serve over HTTPS and add a service worker for the app shell and a clear
  offline state. Do not cache authenticated API responses or private data in
  shared/public caches.
- Add an install prompt/instructions where supported. Users can use the
  browser's **Install app** / **Add to Home Screen** option; installation
  support and UX varies by browser and operating system.
- Use the same login and backend as the extension. The website should be a
  full management surface for sites, saved pages, personal information, and
  sync settings.
- Make changes visible in the other client after sync. Realtime subscriptions
  can improve responsiveness later; correct versioned sync is more important
  for the first release.

## Resume privacy decision

The current resume exists only in extension IndexedDB and does not have a
recoverable original file path. Do not upload it automatically.

Recommended first release: sync personal details, tracked sites, and saved
pages, but leave the resume local. If cross-device resume access is requested,
add a separate opt-in upload to a private per-user bucket, with file-size/type
limits, signed access, replacement/deletion controls, and a clear statement
that uploaded files leave the device.

## Job notifications, office hours, and optional location

The default should be **no job notifications during configured quiet/office
hours**. Location should be an optional helper, not a requirement for using
Jarvis, and should never be used to infer that a person is working without
their explicit permission.

### User controls

- Add a notification settings page with one global on/off switch and separate
  controls for job reminders, follow-ups, and other notification types.
- Let the user choose timezone, workdays, office start/end times, and an
  optional broader quiet-hours window. Handle daylight-saving changes using
  the selected timezone.
- Provide **Pause notifications today**, **Pause until…**, and an obvious
  way to resume notifications.
- Allow the user to select an office status manually: **In office**, **Not in
  office**, or **Probably in office**. Make each choice temporary, with a
  clear expiry (for example, end of the workday), not permanent by default.
- When enabled, an optional, low-frequency prompt can ask **“Are you in the
  office?”** around the user's chosen time. The choices update today's
  notification suppression state. Do not repeatedly prompt after an answer;
  include a reminder cooldown and dismissal option.

### Location behavior and consent

- Keep location access off by default. Explain why it is requested, what the
  app will do, and how to disable it before showing the browser/OS permission
  prompt. Access is only active after both explicit in-app opt-in and OS/
  browser permission.
- If the user opts in, prefer an on-device geofence check against an office
  location the user deliberately configures. Do not collect location in the
  background continuously just to decide whether to send job reminders.
- Prefer evaluating proximity on-device. Do not send or store a location
  history or exact coordinates on the server. If remote processing is ever
  proposed, ask separately and document retention before implementing it.
- If location permission is denied, unavailable, or stale, fall back to the
  selected schedule or ask the user; do not treat missing location as consent
  to notify during office hours.
- Location permission and geofence behavior differ across browsers and
  operating systems. A web page/PWA generally cannot guarantee reliable
  background location checks while closed, so schedule-based quiet hours must
  work independently.

### Notification decision order

Before creating any job notification:

1. If all notifications are disabled, do not send it.
2. If the category is disabled or the user has paused notifications, do not
   send it.
3. If current time is within configured quiet/office hours, suppress it.
4. If the user explicitly selected **In office** or **Probably in office**
   and that status has not expired, suppress it.
5. If the optional on-device location check confidently reports the configured
   office geofence, suppress it; otherwise follow the schedule and manual
   status, not a guessed location.
6. Queue eligible reminders for the next allowed time rather than dropping
   them, and avoid sending stale or duplicate reminders after quiet hours.

Job reminders should be opt-in, grouped/rate-limited, and private by default
(for example, do not put company names or sensitive notes in lock-screen
notification text). Provide a quiet test mode and explain why a notification
was paused or delivered.

## Phone home-screen widget

A PWA can be installed as an app on supported browsers, but a PWA alone cannot
provide a reliable, interactive home-screen widget on every phone:

- **First step:** make the PWA dashboard responsive and provide a clear
  **Install app / Add to Home Screen** flow. Show job-application progress
  inside the app and support web push where the browser/OS supports it.
- **Android:** a true home-screen widget generally requires a native Android
  app or a trusted web activity paired with a native widget. Add a small
  Android companion only if users confirm they want an at-a-glance widget.
- **iPhone/iPad:** a true home-screen widget requires a native iOS companion
  using WidgetKit; an installed website/PWA cannot implement a general-purpose
  WidgetKit widget by itself.
- **Widget content:** show user-approved, privacy-safe summaries such as
  application counts by status, follow-ups due, or a progress goal. Avoid
  names, phone numbers, employer details, or other sensitive content on the
  lock screen. Tapping the widget should open the relevant Jarvis page.
- **Refresh expectations:** phone operating systems control widget refresh
  frequency and may show cached data. The widget must display a last-updated
  time and never promise live sync.
- Use the same authenticated backend and user-scoped APIs as the website.
  Store only the minimum cache needed for display; provide sign-out and clear
  cached data behavior.

## Delivery phases

### Phase 1 — Product and security foundations

- Confirm supported browsers and hosting region.
- Choose whether personal details and saved page selections are included in
  sync; default to explicit opt-in.
- Create the Supabase project, migrations, RLS policies, and development/
  production environments.
- Define account deletion, export, sign-out, and recovery behavior.

**Done when:** one test account can only access its own test records, and
unauthenticated requests cannot read private data.

### Phase 2 — Website MVP

- Build sign-in/sign-out and an account/sync settings page.
- Add editable forms and lists for personal details, tracked sites, and saved
  pages.
- Add export and delete controls.

**Done when:** edits persist across refreshes, users can delete records, and
two separate test accounts cannot see each other's data.

### Phase 3 — Extension account link and first sync

- Add “Sign in to sync” and explicit upload/merge consent.
- Migrate existing local records without losing the local-only mode.
- Add sync status, retry handling, and safe conflict detection.
- Sync personal details, tracked sites, and saved pages between extension and
  website.

**Done when:** a change made in either client appears in the other after sync,
offline edits survive reconnect/restart, retries do not duplicate records,
and conflicting edits are not silently lost.

### Phase 4 — Installable PWA

- Add manifest, icons, HTTPS deployment, and service worker.
- Test install, update, launch, sign-in, and offline behavior on target
  browsers/devices.

**Done when:** the website can be installed from supported browsers and the
  user can tell when they are offline or their data is unsynced.

### Phase 5 — Optional resume sync and quality improvements

- Decide whether to support private cloud resume storage.
- Add conflict history, realtime refresh, app backup/restore, and sync
  diagnostics if user feedback warrants them.

**Done when:** any resume upload is opt-in, private to its owner, removable,
and covered by a documented retention/deletion policy.

### Phase 6 — Notification preferences and quiet hours

- Add category controls, timezone-aware work/quiet schedules, pause/resume,
  and temporary manual office status.
- Add the optional “Are you in the office?” prompt with cooldown and
  Yes/No/Probably-style choices; make the answer expire at the configured
  time.
- Implement and test the notification decision order before adding location.
- Add optional location opt-in only if schedule and manual controls are not
  sufficient; keep any geofence evaluation on-device where possible.

**Done when:** reminders are reliably suppressed during quiet hours and
temporary office status, disabled notifications remain disabled, stale
reminders are not unexpectedly replayed, and location can be disabled or
denied without breaking the schedule-based behavior.

### Phase 7 — Phone progress widget evaluation

- Collect feedback on useful progress metrics and privacy-safe display.
- Deliver the PWA dashboard first and evaluate install/push support on target
  devices.
- If a true widget is still required, build and maintain the appropriate
  Android and/or iOS companion; do not imply the PWA itself provides it.

**Done when:** the selected platform widget shows an understandable cached
progress summary, last-updated time, and safe tap-through, with documented OS
refresh limitations and sign-out/cache-clearing behavior.

## Risks and recommendations

- **Privacy:** Personal details and resume documents are sensitive. Collect
  only what the user chooses, keep the service-role key server-side, enforce
  RLS, and offer account export/deletion.
- **Sync correctness:** A simplistic “overwrite local with server” sync can
  destroy offline edits. Use stable IDs, versions, deletion tombstones, and
  conflict detection from the beginning.
- **Browser storage is not a shared database:** Extension storage, website
  storage, and PWA storage are separate. The authenticated sync API is the
  bridge.
- **Use an installable PWA before building separate mobile apps:** It gives a
  single website codebase and install-like experience with less maintenance.
- **Keep the resume local initially:** It reduces security and storage work;
  add cloud upload only when cross-device resume access is a confirmed need.
- **Avoid collecting browsing history:** Only sync websites the user explicitly
  tracks and pages the user explicitly saves.
- **Location is sensitive:** Schedule-based quiet hours should be the default.
  Never collect continuous location history; make geofencing optional,
  explicit, revocable, and on-device where possible.
- **Notifications can expose job-search activity:** Keep notification text
  generic by default, provide category/quiet-hour controls, and make office
  status temporary and user-controlled.
- **A website install is not a native widget:** Budget for native platform
  work if Android/iOS home-screen widgets are a confirmed requirement.

## Suggested first-release scope

Build the website/PWA with account sign-in and two-way sync for personal
details, tracked job sites, and saved pages. Keep the resume local, make sync
opt-in, and use Supabase PostgreSQL with RLS. Defer realtime, shared accounts,
cloud resume storage, location-based office detection, and native phone widgets
until the basic sync and schedule-based notifications have been tested and
users ask for them. Start office-hours suppression with an editable schedule
and manual office-status prompt; treat location as optional. Ship the PWA
dashboard before investing in native widgets.
