# Jarvis Web

The Next.js app is the web companion to the Jarvis browser extension. It has
its own package and can be run and deployed independently from the extension.

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available checks

- `npm run lint` — run ESLint.
- `npm run typecheck` — check TypeScript types.
- `npm run build` — create a production build.

## Supabase status

The app includes email/password authentication, a protected dashboard, and
feature modules for personal details, tracked sites, and saved pages. Supabase
is not connected to a live project until you provide local credentials and
apply the SQL migration. No extension data is uploaded or synced.

Follow [`../supabase/README.md`](../supabase/README.md) to create and configure
your project. Track website implementation and setup progress in
[`../docs/features/WEBSITE.md`](../docs/features/WEBSITE.md). The shared
product/sync plan is in [`../docs/PLANNER.md`](../docs/PLANNER.md), and
architecture decisions are in [`../docs/decisions/README.md`](../docs/decisions/README.md).
The PWA, push-notification, and mobile-widget roadmap is in
[`../docs/features/PWA.md`](../docs/features/PWA.md).
