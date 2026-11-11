# Decision log

Record decisions that affect architecture, storage, privacy, browser
permissions, or user-visible behavior. This makes later changes understandable
without relying on chat history.

## Suggested entry

```text
## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context: What question or tradeoff led to this decision?
- Decision: What did we choose?
- Consequences: What becomes easier, harder, or incompatible?
- Revisit when: What evidence would make us reconsider?
```

Keep entries concise and link to the affected feature spec or implementation.

## 2026-11-11 — Keep the web app in the Jarvis repository

- Status: accepted
- Context: The planned Next.js website will share account and sync behavior
  with the existing browser extension.
- Decision: Keep the website in `web/` with its own `package.json`; keep the
  planner and decision log shared at the repository root.
- Consequences: The apps can be developed and deployed independently while
  sharing one source of product and architecture decisions.
- Revisit when: The website becomes an independently maintained product or
  needs separate access and release ownership.

## 2026-11-11 — Use Supabase as the shared sync source

- Status: accepted
- Context: The website already stores authenticated user data in Supabase;
  the extension currently stores its data only in browser-local storage.
- Decision: The website and extension will use the same Supabase account and
  database as their shared source of truth. The extension remains local-first
  and must not upload existing data until the user signs in and explicitly
  opts in. Initial sync scope is personal details, tracked sites, and saved
  pages; the resume stays local. On deletion, remove the record content
  immediately and retain only its owner ID, type, record ID, and deletion time
  as a minimal tombstone until account deletion.
- Consequences: Both clients need user-scoped access, stable record identity,
  offline-safe synchronization, deletion propagation, and conflict handling.
  RLS must protect all synced records. Extension authentication and migration
  from local storage are tracked feature-by-feature in
  [`../features/SYNC.md`](../features/SYNC.md).
- Revisit when: Users request cloud resume storage or test results show the
  proposed sync scope or conflict flow needs to change. The user selected
  minimal tombstones on 2026-11-11.
