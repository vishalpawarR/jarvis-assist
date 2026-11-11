# Supabase setup for Jarvis

Supabase provides authentication and PostgreSQL for the website. The extension
continues to store data locally; creating an account does **not** upload or
synchronize extension data.

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
initial migration. The sync foundation adds a second migration:

1. Open **SQL Editor** → **New query**.
2. Paste the contents of
   [`migrations/202611110002_sync_tombstones.sql`](./migrations/202611110002_sync_tombstones.sql).
3. Run it and check that Supabase reports success.

This migration creates a read-only, per-user `sync_tombstones` table. A
database trigger records only the owner ID, record type, record ID, and
deletion time when an authenticated owner deletes a personal-details, tracked
site, or saved-page row. The original row is still physically deleted, so its
content is not retained for sync. Account deletion cascades to its tombstones.
The extension does not consume these tombstones until its sync feature is
implemented.

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
