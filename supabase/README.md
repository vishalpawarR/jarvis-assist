# Supabase setup for Jarvis

Supabase provides authentication and PostgreSQL for the website and extension.
The extension continues to store data locally until you explicitly select
categories and opt in to sync.

## Create and configure a project

1. Create a Supabase project from the Supabase dashboard and save its database
   password securely outside this repository.
2. In **Project Settings → API Keys**, copy the project URL and the
   **publishable** key. Do not use a secret/service-role key in the website.
3. Copy `web/.env.example` to `web/.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
4. In **Authentication → URL Configuration**, set the local Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/callback` to
   the allowed redirect URLs.
5. In **Authentication → Providers → Email**, enable email/password sign-in.
   Keep email confirmation enabled; sign-up returns a confirmation notice and
   the callback establishes the session after the user confirms.

## Create the database tables and policies

Open the project's **SQL Editor**, create a new query, paste and run
[`migrations/202611110001_initial_jarvis_data.sql`](./migrations/202611110001_initial_jarvis_data.sql).
The migration creates the initial user-owned tables, indexes, grants, and RLS
policies. Keep this SQL file as the source of truth for future changes.

The tables are `personal_details`, `tracked_sites`, and `saved_pages`.
Each includes or is keyed by the authenticated user's ID. RLS is enabled and
client roles receive only the permissions needed by the app. Row policies
restrict access to `auth.uid()`. The website also derives the owner ID from
the verified server-side session.

### Apply later migrations

When a new feature adds a migration, run only the migrations you have not
already applied, in filename order. For this existing project, do not rerun the
initial migration. The sync foundation adds follow-up migrations:

1. Open **SQL Editor** → **New query**.
2. Paste the contents of
   [`migrations/202611110002_sync_tombstones.sql`](./migrations/202611110002_sync_tombstones.sql).
3. Run it and check that Supabase reports success.
4. Repeat with
   [`migrations/202611110003_clear_recreated_tombstones.sql`](./migrations/202611110003_clear_recreated_tombstones.sql).
5. Apply
   [`migrations/202611110004_push_subscriptions.sql`](./migrations/202611110004_push_subscriptions.sql)
   before enabling daily push notifications. The push feature and required
   VAPID configuration are documented below.

This migration creates a read-only, per-user `sync_tombstones` table. A
database trigger records only the owner ID, record type, record ID, and
deletion time when an authenticated owner deletes a personal-details, tracked
site, or saved-page row. The original row is still physically deleted, so its
content is not retained for sync. Account deletion cascades to its tombstones.
The extension queues local deletions as metadata-only entries. The third
migration clears an old tombstone when its owner recreates the same record,
so a prior deletion cannot permanently block restored personal details or
tracked records.

Apply all three migrations before enabling extension sync. The extension
uploads/downloads only the categories you select after reviewing the preview.
Once enabled, it syncs on startup, popup open, meaningful local edits, and a
15-minute retry schedule. Website changes are saved directly to Supabase and
are picked up by the extension on its next sync; the extension does not use a
realtime subscription. Resume files are never uploaded.

## Run and verify locally

```powershell
cd web
npm install
npm run dev
```

Open `http://localhost:3000`, create an account, confirm the email, then sign
in. Add personal details, sites, and pages in the dashboard.

Before using real personal data, create two test accounts and verify each sees
only its own rows. Account creation, login, and cloud-backed feature forms
require your Supabase project; lint, type checks, and production builds do not.

## Secret handling

- Never commit `web/.env.local`, database passwords, or Supabase secret keys.
- The publishable key is intended for app configuration; RLS is the data access
  boundary. It is not a substitute for user-scoped policies.
- Never add a service-role key to client-side code or `NEXT_PUBLIC_*` variables.
- The extension uses the same project URL and publishable key as the website.
  Its password is used only for the sign-in request; the extension stores a
  refresh token in this browser profile until you sign out. Avoid shared
  browser profiles for personal sync accounts.
