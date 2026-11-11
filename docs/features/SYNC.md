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
- [ ] Confirm extension sign-in callback support for Chrome and Edge before
      selecting an authentication flow or adding browser permissions.

### Sync foundations

- [ ] Define shared record fields, timestamps, stable IDs, and deletion
      semantics without breaking existing local records.
- [ ] Make deletes sync-safe while avoiding indefinite retention of deleted
      personal information; document tombstone retention and cleanup.
- [ ] Add any required forward-only Supabase migration, RLS policy, and
      generated TypeScript database types.
- [ ] Add an extension-only Supabase client/auth module without changing
      website authentication behavior.
- [ ] Add extension sign-in, session refresh, sign-out, and credential cleanup.

### Consent and first sync

- [ ] Add separate, clear consent for personal details, tracked sites, and
      saved pages; default each category to local-only.
- [ ] Preview local and cloud record counts before the first merge.
- [ ] Preserve legacy local records and assign/validate stable IDs without
      duplicating existing data.
- [ ] Implement initial upload/download with per-user ownership and
      idempotency.

### Incremental sync and recovery

- [ ] Sync tracked-site creates and edits in both directions.
- [ ] Sync saved-page creates and edits in both directions.
- [ ] Sync personal-detail edits in both directions.
- [ ] Queue offline mutations locally and retry safely after reconnect/restart.
- [ ] Detect simultaneous edits and let the user resolve conflicts.
- [ ] Show local-only, syncing, synced, and needs-attention states with retry,
      pause, disconnect, export, and local-data clearing controls.

### Verification

- [ ] Test each feature's changed surface with targeted checks before commit.
- [ ] Verify two accounts cannot read or modify each other's records.
- [ ] Verify an offline edit survives restart/reconnect and is not duplicated
      by retry.
- [ ] Verify deletion reaches another client without restoring the record.
- [ ] Verify signing out removes extension session credentials and leaves
      local data available unless the user chooses to clear it.

## Preflight checklist and current results

Record failures here instead of broadening a feature to fix unrelated baseline
issues. Re-run the relevant checks after every implementation feature.

| Precheck                                                                      | Result before sync implementation                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Current branch is `feature/supabase-extension-sync`                           | Pass                                                                                  |
| Worktree clean before planning changes                                        | Pass                                                                                  |
| Repository and web-specific instructions read                                 | Pass                                                                                  |
| Local `web/.env.local` exists, is ignored, and is not tracked                 | Pass; its contents were not inspected                                                 |
| User confirmed the initial SQL migration succeeded                            | Pass; Supabase reported “Success. No rows returned”                                   |
| User confirmed local Site URL/callback URLs and Email provider are configured | Pass; verify email-confirmation behavior during account testing                       |
| Extension syntax check (`npm run check:syntax`)                               | Pass                                                                                  |
| Web lint (`cd web; npm run lint`)                                             | Pass                                                                                  |
| Web typecheck (`cd web; npm run typecheck`)                                   | Pass                                                                                  |
| Web production build (`cd web; npm run build`)                                | Pass                                                                                  |
| Repository formatting check (`npm run format:check`)                          | Existing baseline failure: Prettier reports 52 files; do not reformat unrelated files |
| Two-account RLS isolation against the user's live project                     | Pending; required before sync rollout                                                 |

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
