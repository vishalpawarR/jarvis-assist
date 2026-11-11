# Jarvis website feature tracker

This is the single progress list for the Next.js website. Product-wide
priorities and the sync roadmap remain in [`../PLANNER.md`](../PLANNER.md);
architecture choices remain in [`../decisions/README.md`](../decisions/README.md).
The website-extension sync implementation has its own feature breakdown in
[`SYNC.md`](./SYNC.md).

Status: **Done** = implemented and locally verified; **Needs setup** = code is
ready but requires a user-owned Supabase project or external validation;
**Planned** = not implemented.

## Foundation

- [x] Next.js App Router, TypeScript, Tailwind, ESLint, and independent `web/`
      package.
- [x] Feature-oriented modules under `web/src/features/`.
- [x] Shared planner and decision log; website-specific progress tracked here.
- [x] Local setup instructions and environment-variable example.

## Accounts and security

- [x] Email/password sign-up and sign-in forms with server-side validation.
- [x] Email-confirmation callback and sign-out.
- [x] Cookie-based Supabase SSR session and protected dashboard route.
- [x] Supabase migration for profile details, tracked sites, and saved pages.
- [x] Row Level Security and grants restricted to authenticated, record-owning
      users; owner IDs are assigned on the server.
- [ ] **Needs setup:** Create a Supabase project, configure email/redirect URLs,
      add local environment variables, and apply the migration.
- [ ] **Needs external validation:** Verify RLS isolation using two separate
      accounts and exercise sign-up confirmation in the configured Supabase project.
- [ ] Password recovery, email change, account deletion, and data export.

## Personal details

- [x] View and edit standard details and custom fields.
- [x] Persist details in the signed-in user's Supabase row.
- [ ] **Needs setup:** Verify saved changes persist against a live Supabase
      project.
- [ ] Import local extension details only after explicit sync consent.

## Tracked job sites

- [x] Add, edit, list, and permanently delete sites.
- [x] Display the saved site count and allow opening the stored URL.
- [ ] Favicon display, last-visited age, and stale-site indicators.
- [ ] Extension-to-website two-way sync with explicit opt-in, conflict handling,
      retries, and tombstone reconciliation.

## Saved pages

- [x] Add, edit, list, and permanently delete saved pages.
- [x] Store selected text/notes and `Read later` versus `Keep forever`.
- [x] Set a 30-day expiry when saving to `Read later`.
- [ ] Search, sort, move between collections, renew expiry, and expiry cleanup.
- [ ] Import and synchronize extension pages with deletion/conflict handling.

## Installable app and notifications

- [ ] Responsive dashboard quality pass and accessibility review.
- [ ] PWA manifest, icons, offline shell, and install guidance.
- [ ] Notification preferences, quiet hours, office status, and optional
      location, following the privacy requirements in the shared planner.
- [ ] Optional cross-device resume storage (separate opt-in; local-only by
      default).

## Acceptance checks for the current slice

- [x] From `web/`: `npm run lint`
- [x] From `web/`: `npm run typecheck`
- [x] From `web/`: `npm run build`
- [ ] Complete account and data CRUD against a configured Supabase project.
- [ ] Confirm one account cannot read or modify another account's records.

## Change history

- 2026-11-11 — Added the Next.js website feature tracker and initial modular
  authentication, dashboard, data management, and RLS foundation.
