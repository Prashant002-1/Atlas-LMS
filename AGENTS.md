# Working in this repository with an AI coding agent

This file is for coding agents (and humans who like a short brief). It is not a
substitute for the docs.

## Orient

- `docs/README.md` is the documentation map. Read it before product work.
- `docs/architecture.md` is the system overview. `docs/adr/` records the
  decisions behind it.
- `docs/DesignSystem.md` and `app/globals.css` are the interface source of
  truth. Tokens win over prose.
- Current code beats historical notes. Do not revive removed directions
  (the old command, cue, or Eve paths) from git history.

## Invariants

- Writes that change a course go through proposals and `lib/agent/apply.ts`.
  No tool writes a grade, post, or publication directly.
- Grading evidence is a verified transcript span, never free text.
- Everything is organization- and course-scoped. Resolve scope on the server
  from the signed-in user, never from client input.
- Provider keys, endpoints, and model ids come from server environment only.
- Model-authored code runs only in the AgentCore boundary in
  `lib/code-execution/`, never in the web or Workflow process.

## Verify

| Change | Gate |
| --- | --- |
| Docs only | `git diff --check` and link check |
| Logic fix | Focused test plus `npm run typecheck` |
| UI change | `npm run verify` |
| Data path or runtime | Reproduce, fix the cause, rerun the smallest end-to-end path |

`npm run verify` runs typecheck, lint, unit tests, and the production build.
`npm run smoke` needs a running dev server.

## Database

- `db:push` only creates an empty database. Existing databases take reviewed
  SQL in `drizzle/` through `npm run db:upgrade`.
- Never edit an applied migration.

## Do not

- Commit `.env*` files, provider keys, database dumps, or personal data.
- Rename a seed asset without updating `asset-manifest.json` and the corpus.
- Clean up unrelated work to simplify a task.
