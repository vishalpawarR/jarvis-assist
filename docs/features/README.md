# Feature documentation

Create one short specification per feature before making significant behavior
changes. Keep the spec close to user-visible behavior and update it when
acceptance criteria or data ownership changes.

## Suggested feature spec

```text
# Feature name

## Purpose
What user problem does this solve?

## Behavior
What happens on the normal path and important edge cases?

## Data
What is stored, where, and when is it deleted?

## Acceptance checks
- [ ] Observable outcome one
- [ ] Observable outcome two

## Change history
Date — What changed and why.
```

For removals, first document the reason and migration/compatibility impact in
the feature spec. Keep product-wide priorities in `../FEATURES.md` and the
longer-term plan in `../PLANNER.md`.
