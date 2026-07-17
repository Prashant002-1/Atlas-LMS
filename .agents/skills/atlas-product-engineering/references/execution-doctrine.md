# Atlas Execution And Collaboration Doctrine

## Keep Product Work Ahead Of Verification Work

Repeated Atlas feedback objected to the ratio of browser inspection, smoke testing, and verification to actual product building. Preserve rigor, but make verification bounded and purposeful.

Use this default matrix:

| Change | Default gate |
| --- | --- |
| Brief answer or read-only audit | No mutation and no unrelated test run |
| Docs-only edit | `git diff --check` plus targeted link or content inspection |
| Narrow logic or bug fix | Focused regression test plus typecheck when relevant |
| Cohesive UI change | One build or verify gate, then at most one targeted rendered check when visual behavior is material |
| Runtime or data-path bug | Reproduce the real failure, inspect logs and state, fix the cause, then rerun the smallest end-to-end path |
| PR checkout or refresh | Confirm branch, upstream, divergence, and worktree state; test only when requested or needed for the stated decision |

If the user says they will visually inspect, already tested, or does not want browser tests, stop at the appropriate code-level gate. Do not keep testing out of habit.

## Build Simply And Rigorously

- Solve the literal problem before expanding it into a framework.
- Prefer a direct fix in the existing ownership boundary over a new abstraction.
- Do not add fallback chains, duplicate state, workaround layers, or compatibility paths merely to make an uncertain path appear robust.
- Do not avoid the core problem with extra UI. Fix the runtime, data, contract, or state boundary that actually failed.
- Keep essential rigor: typed contracts, persisted state, validation at mutation boundaries, focused tests, and clear failure behavior.
- Reuse existing Atlas components, tokens, repository helpers, and data paths.

When a plan starts sounding more complicated than the user's plain statement of the problem, stop and restate the desired reality in one sentence.

## Diagnose From The Real Path

Trace evidence before theorizing:

1. Reproduce or inspect the exact user path.
2. Follow client event handling and request construction.
3. Inspect the actual API or server action.
4. Follow the agent/runtime contract when involved.
5. Verify database schema, seeded values, and persisted rows.
6. Separate code regressions from stale local schema, stopped services, stale test assertions, and environment drift.

Do not stop at the first plausible layer. In prior successful Atlas debugging, the visible symptom required following both the form-submit path and the seeded record path. The fix worked because it removed the actual native form reload and restored the missing persisted topic data, rather than adding retries or UI fallbacks.

## Preserve Persistence And Continuity

The agent should operate against real course records through typed, validated contracts. UI state that matters to the workflow must survive reload and resume correctly.

- Persist sessions, turns, submissions, artifacts, proposals, and settings when the product depends on them.
- Keep the database and agent mutually useful: the database grounds the agent, and structured agent output updates validated records.
- Use forms where explicit durable editing is valuable, but do not multiply form-driven surfaces around every agent capability.
- Make seeded data match the current schema and runtime consumer. Treat stale local schema as an environment problem, not a reason to weaken queries.

## Write Durable Documentation Without Bloat

- Keep `docs/README.md` as the map and update the smallest source-of-truth document.
- Consolidate repeated doctrine instead of restating it in several files.
- Use current-status language for implementation progress. Avoid dates and artificial deadlines unless the user explicitly wants them.
- Make a data or agent contract exact enough for its intended executor, including schema, invariants, output shape, and acceptance criteria.
- Adapt the size of the contract to the executor's context. A cloud agent without filesystem access needs a self-contained prompt; an in-repo agent can use linked code and docs. Concise must still be complete.
- Do not create an elaborate documentation system to clean up documentation overlap.

## Match The Requested Collaboration Mode

- Treat `pull`, `refresh`, `take me to the PR`, `merge`, `run it`, and similar short requests as actions, not invitations for an essay.
- When the user asks for a brief answer, answer briefly.
- When the user asks for initial thoughts only, inspect and report without testing or editing.
- When the user asks for a plan or says `tell me first`, do not mutate state before they review the direction.
- When exact visual geometry, brand artwork, or a high-judgment direction is unclear, show a bounded draft or ask the one question that would materially change the result before rolling it across the app.
- Treat the user's screenshots and visual inspection as authoritative feedback. Do not argue against a concrete visual issue with generic design rules.
- Keep progress updates factual and compact. Report the achieved state first in the final handoff.

## Handle Git And PR Work Directly

Use `gh` for GitHub-facing Atlas work.

1. Inspect `git status --short --branch`, upstream, and PR metadata.
2. Preserve local changes. Use `git pull --ff-only` for a clean branch. Use `git pull --rebase --autostash` only when local fixes must survive a branch refresh and the rebase is safe.
3. For stacked PRs, inspect base and head refs plus ancestry before retargeting or merging. Explain the sequence first when asked.
4. Verify only to the level needed for the user's decision or requested merge.
5. After merging, sync local `main` and report the resulting commit and worktree state.

Do not turn a branch refresh into a broad audit. Do not rerun a full suite after the user says the relevant testing is already complete.

## Repeat The Moves That Earned Trust

- Translate actor feedback into a coherent end-to-end product slice instead of a cosmetic patch list.
- Document a corrected product principle in the existing sources of truth after the user confirms it is durable.
- Present actual records and direct controls after removing attention-management labels.
- Make seed data tell a credible active-course story with concrete counts and unambiguous latest records.
- Follow logs and persisted state to a root-cause fix instead of adding retries or fallback UI.
- Iterate on exact visual feedback before propagating a mark or geometry across the app.
- Execute small Git requests quickly and report only the branch, commit, verification, and remaining local state that matter.
