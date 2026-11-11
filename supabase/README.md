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
   and then
   [`migrations/202611110005_push_delivery_claims.sql`](./migrations/202611110005_push_delivery_claims.sql)
   before enabling daily push notifications.

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

## Enable daily push notifications

The dashboard asks permission only after a signed-in user selects **Enable
daily check-in**. Each browser device stores its own subscription, timezone,
and reminder time. Apply migrations 004 and 005 before enabling this feature.

1. Generate a VAPID key pair from the repository root:

   ```powershell
   npx --yes web-push generate-vapid-keys --json
   ```

   Keep the private key secret. Set the public key as
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `web/.env.local` and in the web deployment
   environment. Never use a `NEXT_PUBLIC_` prefix for the private key.

2. Generate a separate cron secret in PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   $rng.Dispose()
   $pushCronSecret = [Convert]::ToBase64String($bytes)
   $pushCronSecret
   ```

3. Create a secrets file outside the repository with these values, then deploy
   them and the Edge Function from the repository root:

   ```text
   VAPID_PUBLIC_KEY=<generated public key>
   VAPID_PRIVATE_KEY=<generated private key>
   VAPID_SUBJECT=mailto:<your contact email>
   PUSH_CRON_SECRET=<generated cron secret>
   ```

   ```powershell
   supabase link --project-ref <your-project-ref>
   supabase secrets set --env-file <path-outside-repository>\jarvis-push-secrets.env
   supabase functions deploy deliver-daily-checkins
   ```

   The function uses Supabase's injected `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Its JWT check is disabled because the database
   scheduler calls it server-to-server; the function independently requires
   the high-entropy `x-cron-secret` header. Keep both the secrets file and cron
   secret private.

4. In Supabase **Database → Extensions**, enable `pg_cron`, `pg_net`, and
   `supabase_vault` if they are not already enabled. In **SQL Editor**, store
   the project URL and the exact same cron secret in Vault:

   ```sql
   select vault.create_secret(
     'https://<your-project-ref>.supabase.co',
     'jarvis_push_project_url'
   );
   select vault.create_secret(
     '<the same generated cron secret>',
     'jarvis_push_cron_secret'
   );
   ```

5. Schedule the sender once per minute in the SQL Editor. It checks each
   opted-in device's local time and sends at most one check-in per local date:

   ```sql
   select cron.schedule(
     'jarvis-daily-push-delivery',
     '* * * * *',
     $$
     select net.http_post(
       url := (
         select decrypted_secret
         from vault.decrypted_secrets
         where name = 'jarvis_push_project_url'
       ) || '/functions/v1/deliver-daily-checkins',
       headers := jsonb_build_object(
         'content-type', 'application/json',
         'x-cron-secret', (
           select decrypted_secret
           from vault.decrypted_secrets
           where name = 'jarvis_push_cron_secret'
         )
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

6. Sign in to the deployed HTTPS app, enable check-ins on a device, and choose
   a time a few minutes ahead to test. The browser or installed PWA must allow
   notifications; iOS/iPadOS requires opening the installed home-screen app.
   Check Edge Function logs and `cron.job_run_details` if a test does not
   arrive. Delete test schedules with `cron.unschedule(<jobid>)` when needed.

The notification contains only a generic check-in and a link to the dashboard;
it never includes personal details, saved page text, or resume data. The cron
secret is sent through `pg_net`; restrict database access because pending HTTP
request headers may be visible to privileged database roles.
