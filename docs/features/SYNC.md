# Website and extension sync

This tracker breaks shared Supabase sync into small, reviewable features. The
website and extension will use the same Supabase account and database as the
source of truth. The extension stays local-first: existing data is not uploaded
until the user signs in and explicitly opts in.

## Initial scope

- Sync personal details, tracked sites, and saved pages.
- Keep the resume in extension-local storage; resume upload is out of scope.
- Keep the extension usable while signed out or offline.
- Use stable record IDs, idempotent retries, and deletion propagation.
- Bind local queues to an account only after explicit consent; never replay
  queued changes across account switches.
- Detect conflicting edits and ask the user to choose; do not silently replace
  personal details or saved text.
- Never put a Supabase secret/service-role key in the website or extension.
- Enforce account ownership with Supabase Row Level Security (RLS).

## Small feature sequence

Complete and commit one feature at a time. Update this checklist and the shared
website tracker as each feature is verified.

### Planning and preflight

- [x] Create the dedicated `feature/supabase-extension-sync` branch.
- [x] Read the web-specific agent guidance, existing data model, migration,
      product plan, and decision log.
- [x] Record baseline checks and known failures below.
- [x] Use email/password sign-in in the extension; this flow needs no OAuth
      callback or additional browser permissions.

### Sync foundations

- [x] Add a forward-only migration for owner-scoped minimal tombstones; RLS
      permits owners to read only their own tombstone metadata.
- [x] Record tombstones atomically when an authenticated owner deletes a
      server record; delete the original content and cascade tombstones with
      account deletion.
- [x] Clear a matching tombstone on an authenticated record recreation so a
      later save does not remain hidden by an earlier deletion.
- [x] Preserve extension-local tracked-site, saved-page, and personal-detail
      deletes as metadata-only local outbox entries.
- [x] Define a shared record contract with stable IDs, timestamps, and conflict
      semantics without breaking existing local records.
- [x] Add an extension-only Supabase Auth client without changing website
      authentication behavior.
- [x] Add extension sign-in, token refresh, sign-out, and local credential
      cleanup.

### Consent and first sync

- [x] Add separate, clear consent for personal details, tracked sites, and
      saved pages; default each category to local-only.
- [x] Bind signed-out local changes and deletions only to the account the user
      explicitly approves; prevent cross-account replay on account switches.
- [x] Preview local and cloud record counts before the first merge.
- [x] Preserve legacy local records and assign/validate stable IDs without
      duplicating existing data.
- [x] Implement initial upload/download with per-user ownership and
      idempotency.

### Incremental sync and recovery

- [x] Sync tracked-site creates and edits in both directions.
- [x] Sync saved-page creates and edits in both directions.
- [x] Sync personal-detail edits in both directions.
- [x] Keep offline edits in local storage and retry on startup, popup open,
      local edits, and a 15-minute alarm.
- [x] Detect simultaneous edits and let the user resolve conflicts.
- [x] Show local-only, syncing, synced, conflict, and needs-attention states
      with manual retry, pause/resume, sign-out, and export.
- [ ] Add an account-scoped control to clear synchronized local data.
- [x] Refresh cloud data when the popup opens; the extension does not use a
      realtime subscription.

### Verification

- [x] Test the transfer engine with mocked Supabase REST responses and run
      targeted syntax, test, formatting, and whitespace checks.
- [ ] Verify two accounts cannot read or modify each other's records.
- [ ] Verify an offline edit survives a real browser restart/reconnect and is
      not duplicated by retry.
- [ ] Verify deletion reaches another client without restoring the record.
- [x] Verify signing out removes extension session credentials and leaves
      local data available unless the user chooses to clear it.

## Preflight checklist and recorded results

Record failures here instead of broadening a feature to fix unrelated baseline
issues. Re-run the relevant checks after every implementation feature.

| Precheck                                                                      | Result recorded on 2026-11-11                                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Current branch is `feature/supabase-extension-sync`                           | Pass                                                                                                           |
| Worktree clean before planning changes                                        | Pass                                                                                                           |
| Repository and web-specific instructions read                                 | Pass                                                                                                           |
| Local `web/.env.local` exists, is ignored, and is not tracked                 | Pass; its contents were not inspected                                                                          |
| User confirmed the initial SQL migration succeeded                            | Pass; Supabase reported “Success. No rows returned”                                                            |
| User confirmed local Site URL/callback URLs and Email provider are configured | Pass; verify email-confirmation behavior during account testing                                                |
| User applied the sync tombstone migration and tested a website delete         | Pass; Supabase showed a recent `tracked_sites` tombstone                                                       |
| Recreated-record tombstone migration (`202611110003`)                         | Pending; apply before enabling sync                                                                            |
| Extension syntax check (`npm run check:syntax`)                               | Pass                                                                                                           |
| Sync, tombstone, and auth tests (`npm run test:sync`)                         | Pass; 23 tests including preview, consent, two-way merge, tombstones, conflict resolution, and account consent |
| Targeted Prettier check for changed sync files                                | Pass after formatting                                                                                          |
| `git diff --check`                                                            | Pass                                                                                                           |
| Web lint (`cd web; npm run lint`)                                             | Pass                                                                                                           |
| Web typecheck (`cd web; npm run typecheck`)                                   | Pass                                                                                                           |
| Web production build (`cd web; npm run build`)                                | Pass                                                                                                           |
| Repository formatting check (`npm run format:check`)                          | Existing baseline failure: Prettier reports 52 files; do not reformat unrelated files                          |
| Two-account RLS isolation against the user's live project                     | Pending; required before sync rollout                                                                          |

### Required checks before each feature commit

1. Confirm the branch is still `feature/supabase-extension-sync` and inspect
   `git status`; do not include unrelated user changes.
2. Read the feature's touched modules and the applicable repository guidance.
3. Run the narrowest relevant tests/checks, then run `git diff --check`.
4. For migrations, verify RLS and ownership rules, keep the migration
   forward-only, and document how to apply it to the already-existing Supabase
   project. Do not modify the already-applied initial migration.
5. Review the staged diff and confirm no environment files, keys, or unrelated
   formatting changes are included.
6. Commit only after the feature's checks pass. Record the commit and result in
   this tracker.

## Feature-wise commit convention

Use one focused commit for each completed feature, not one commit for the whole
sync project. Use Conventional Commit-style subjects:

- `docs(sync): record sync rollout plan` — planning/checklist changes only.
- `feat(sync): add extension sign-in` — one user-visible capability.
- `fix(sync): preserve offline deletes` — a focused correctness fix.
- `test(sync): cover retry idempotency` — tests for one behavior.

Keep unrelated features out of the same commit. Include the repository's
required Copilot co-author trailer on commits. Do not push commits unless
requested.

## Change history

- 2026-11-11 — Added sync feature breakdown, preflight results, and commit
  conventions on `feature/supabase-extension-sync`.
- 2026-11-11 — Added the minimal, owner-scoped server tombstone contract;
  extension-local deletion queuing remained a separate implementation slice.
- 2026-11-11 — Added a local metadata-only deletion queue for the extension's
  site, saved-page, and personal-detail delete actions; no sync is sent yet.
- 2026-11-11 — Added extension account connection with the website's Supabase
  project, password sign-in, token refresh, sign-out, and local session
  cleanup; selected data categories are not transferred yet.
- 2026-11-11 — Added consent-gated preview, two-way merge, deletion handling,
  conflict resolution, and extension refresh on local edits, popup open,
  startup, and a 15-minute retry alarm (`318433a`). Mocked sync tests pass;
  live Supabase verification remains pending.
