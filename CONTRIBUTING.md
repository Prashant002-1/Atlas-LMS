# Contributing to Atlas

**Start with [`docs/README.md`](docs/README.md).** It points to the current thesis, demo target, and v0 build plan.

The shorthand: Atlas is teacher-shaped, grounded in course records, and evidence-backed. If a feature makes Atlas act outside professor-defined scope, invent labels or thresholds, or grade without verified evidence, it does not belong in Atlas.

## Engineering conventions
- Every course-changing **write** goes through a reviewable approval path. No tool posts, grades, sends, or publishes directly.
- Every **query** uses criteria the user supplied — never an inferred default.
- Everything is **org-scoped** and persistent.
- **Design:** quiet, monochrome, upscaled from the original — see [`docs/DesignSystem.md`](docs/DesignSystem.md).

## Workflow
- Branch from `main`, open a PR, keep commits scoped.
- `npm run lint && npm run typecheck && npm test` before pushing.
