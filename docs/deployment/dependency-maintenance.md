# Dependency maintenance

Atlas treats the committed lockfile as the dependency source of truth. Pull
requests and changes to `main` install it with `npm ci`, run the repository
verification gate, validate the database release path against disposable
PostgreSQL and pgvector databases, and build the production container.

## Automated proposals

Dependabot checks npm and GitHub Actions every Monday. Compatible AI SDK,
Workflow, Next.js, and styling updates are grouped only with packages that
share a verification story. Major releases stay separate. Dependency pull
requests are never auto-merged and run the same CI gate as application work.

GitHub dependency alerts and Dependabot security updates must remain enabled
for the repository. Workflow actions are pinned to immutable commit SHAs, with
Dependabot responsible for proposing reviewed pin updates.

## Audit policy

CI runs this production-tree gate:

```bash
npm audit --omit=dev --audit-level=moderate
```

Any moderate, high, or critical production finding blocks the change. Fix it
with a compatible direct or transitive update when one exists. Use a narrowly
scoped package override only when the owning package has not yet released a
patched dependency, and remove the override after upstream catches up. Never
run `npm audit fix --force`.

The full development-tree report is reviewed during dependency changes and by
Dependabot, but a development-only advisory may be accepted when it is not
reachable from the production image and no safe upstream fix exists. Record
the package chain, exposure, upstream status, and recheck condition here.

## Current overrides

### `@ai-sdk/workflow` nested AI SDK copies

`@ai-sdk/workflow` 1.x pins exact versions of `ai`, `@ai-sdk/provider`, and
`@ai-sdk/provider-utils`. Once the root `ai` and `@ai-sdk/*` packages move
past those pins, npm installs a second copy under
`node_modules/@ai-sdk/workflow/node_modules`, and `WorkflowChatTransport`
then types its messages against the old `UIMessage`, which fails the
typecheck in the three chat rooms. The scoped override in `package.json`
points the nested `ai` at the root range (`$ai`) and lets the provider
packages float at or above the pinned versions, so one copy is installed.

If a future AI SDK bump still produces a nested copy, remove the
`node_modules/@ai-sdk/workflow/node_modules/{ai,@ai-sdk/*}` entries from
`package-lock.json` and run `npm install`; `npm dedupe` does not hoist them.
Remove the override once `@ai-sdk/workflow` declares ranges instead of exact
pins, or once Atlas moves to a 2.x release together with Workflow 5.

## Current development-only exceptions

### esbuild development server under drizzle-kit

As of 2026-10-19, the full audit reports four moderate entries in the chain
`drizzle-kit -> @esbuild-kit/esm-loader -> @esbuild-kit/core-utils -> esbuild`.
The advisory concerns the esbuild development server. Atlas does not expose
that server, and none of these packages are installed by the production
container's `npm ci --omit=dev` stage. `drizzle-kit` 0.31.11 is the current
release in Atlas's dependency track, while npm incorrectly proposes the older
0.18.1 release as the available fix. Recheck this exception on every
`drizzle-kit` update or new advisory. Remove it once the current package line
ships a patched esbuild dependency.

### braces pattern expansion under eslint-config-next

As of 2026-10-19, the full audit reports five high entries in the chain
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch ->
braces`. The advisory (GHSA-vfj7-8cjw-p6xm) is a stack-exhaustion denial of
service when `braces` expands a deeply nested glob pattern. Atlas only runs
this code when `eslint` scans the repository's own source during `npm run
lint`, and none of these packages are installed by the production
container's `npm ci --omit=dev` stage. No patched `braces` release exists:
3.0.3 is the latest published version and the advisory covers every release,
so npm offers only a downgrade of `eslint-config-next` to 14.2.35, which is
not a fix. Recheck this exception on every `eslint-config-next` update or new
advisory. Remove it once `braces` ships a patched release and the
`eslint-config-next` line picks it up.
