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

Supabase is not connected yet. No credentials or user data are required to run
this starter. The shared product plan, including the recommended PostgreSQL,
authentication, data model, and sync approach, is in
[`../docs/PLANNER.md`](../docs/PLANNER.md). Architecture decisions are kept in
[`../docs/decisions/README.md`](../docs/decisions/README.md), not copied into
this app.

When we set up Supabase, create a project first, then add only its URL and
publishable key to a local `.env.local` file. Never put a service-role key in
browser code or commit credentials. We will add the client, database migrations,
and row-level security policies as separate, verifiable steps.
