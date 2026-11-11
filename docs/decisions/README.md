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
