---
name: atlas-product-engineering
description: Apply Atlas-LMS's repository-specific product, UX, engineering, debugging, documentation, verification, and Git collaboration doctrine. Use for any Atlas-LMS product planning, UI implementation, feature work, bug diagnosis, seed or demo-data change, docs update, code review, local runtime task, or PR and branch operation. Do not use outside the Atlas-LMS repository.
---

# Atlas Product Engineering

Use this as the operating doctrine for Atlas work. It captures repeated product direction, design feedback, development frustrations, and the approaches that earned trust across prior Atlas sessions.

## Enforce Repository Scope

1. Resolve the Git root.
2. Confirm the root contains `PRODUCT.md`, `docs/Vision.md`, and `docs/DesignSystem.md` for Atlas-LMS.
3. Stop using this skill if those checks fail. Never copy, install, or apply this skill outside this repository.

## Use Current Truth First

Apply this precedence:

1. The current user request.
2. Current code, behavior, and the documentation map in `docs/README.md`.
3. This skill's durable doctrine.
4. Historical notes, prototypes, and old issue language only when explicitly requested.

Treat current artifacts as authoritative when old session details drift. Do not revive the removed command, cue, or Eve direction from history.

## Orient in Proportion to the Task

- For product, UX, UI, copy, or seed-world work, read `PRODUCT.md`, `docs/README.md`, and the relevant current docs before deciding the shape of the change.
- For a bug, trace the real client, server, agent, database, and runtime path involved before proposing a cause.
- For a narrow Git or PR request, inspect only branch state, local changes, remotes, and PR metadata needed to act. Do not turn it into a product audit.
- For a brief factual question, answer from the narrow source of truth and stay brief.

## Work in This Order

1. State the literal user or actor outcome internally. For a plan or audit, restate the actual problem in one plain sentence before expanding it.
2. Inspect the smallest set of current docs, code, data, and runtime evidence needed to understand that outcome.
3. Build or fix the highest-leverage coherent slice. Do not substitute testing, browser inspection, labels, or scaffolding for product progress.
4. Validate in proportion to risk with one credible gate or a small targeted set.
5. Report the result, remaining limitation, and exact run or test command briefly.

If the user says `tell me first`, `audit`, `chat`, `do nothing else`, or otherwise withholds change authority, remain read-only.

## Apply the Core Judgment

- Own the product, design, and implementation. Testing supports that work; it is not the work.
- Prefer the simplest rigorous solution that resolves the real problem. Reject fallback mazes, workaround layers, and abstractions that avoid the root cause.
- Build from instructor and student journeys, not from a checklist of reachable routes or generic dashboard components.
- Present actual course records and direct controls. Do not assign attention, narrate workflow, expose implementation details, or explain ordinary software to a competent user.
- Keep the interface lean without removing essential capability. Reduce conceptual layers, duplicated controls, repeated copy, nested containment, and fake states.
- Preserve persistence and continuity. Agent interactions, forms, submissions, proposals, and settings must resume from real stored state when the workflow requires it.
- Preserve user changes and dirty-worktree boundaries. Never clean up unrelated work just to simplify the task.

## Load the Detailed Doctrine

- Read [references/product-doctrine.md](references/product-doctrine.md) for product direction, actor journeys, interface posture, visual language, copy, and demo-data credibility.
- Read [references/execution-doctrine.md](references/execution-doctrine.md) for implementation, debugging, verification, documentation, collaboration, and Git workflows.
- Read both for mixed product and engineering tasks.

For a pure branch refresh, checkout, or merge, the execution reference is enough. For a visual or product task, do not skip the product reference.
