# Contributing to Atlas

**Read [`docs/Philosophy.md`](docs/Philosophy.md) first.** It is the operating doctrine for the product and it governs every contribution.

The shorthand: **Atlas is the professor's agent, not an agent that manages the professor** — reactive, propose-only, grounded, professor in control. If a feature makes Atlas act on its own initiative, surface unsolicited judgments (e.g. "at-risk" flags), invent thresholds, or apply changes without explicit approval, it does not belong in Atlas.

## Engineering conventions
- Every agent **write** goes through a reviewable `change_proposals` record the user approves. No tool posts, grades, sends, or publishes directly.
- Every **query** uses criteria the user supplied — never an inferred default.
- Everything is **org-scoped** and persistent (see `docs/Architecture.md`).
- **Design:** quiet, monochrome, upscaled from the original — see [`docs/DesignSystem.md`](docs/DesignSystem.md).

## Workflow
- Branch from `main`, open a PR, keep commits scoped.
- `npm run lint && npm run typecheck && npm test` before pushing.
