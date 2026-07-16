# Atlas professor agent tool contracts

This directory is the source-backed reference for what the professor agent can and cannot do in PR #34. The documented implementation baseline is code commit `7bbb714`; later documentation-only commits do not change that baseline.

It describes executable code, not intended future behavior. Every capability statement points to the implementation symbol that proves it.

## Current tool registry

The runtime exposes exactly eight tools:

| Tool | Kind | Purpose | Contract |
| --- | --- | --- | --- |
| `inspect_lms` | Read | Read scoped LMS data by resource | [Read tools](read-tools.md#inspect_lms) |
| `read_gradebook` | Read and calculate | Read course, assignment, roster, or individual student grade data | [Read tools](read-tools.md#read_gradebook) |
| `search_course` | Read | Case-insensitive text search across selected course data | [Read tools](read-tools.md#search_course) |
| `mutate_lms` | Direct write | Execute one typed LMS action | [Write tools](write-tools.md#mutate_lms) |
| `load_skill` | Filesystem read | Load one reviewed workflow from `.atlas/skills` | [Read tools](read-tools.md#load_skill) |
| `draft_ai_assignment` | Draft write | Store an AI assignment proposal for Review | [Draft tools](draft-tools.md#draft_ai_assignment) |
| `draft_rubric` | Draft write | Store a rubric revision proposal for Review | [Draft tools](draft-tools.md#draft_rubric) |
| `draft_course` | Draft write | Store up to six course-object proposals for Review | [Draft tools](draft-tools.md#draft_course) |

Proof: `professorOperatorTools` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) returns this registry. The three draft tools come from `professorTools` in [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).

`inspect_course` still exists inside `professorTools`, but `professorOperatorTools` does not return it. It is therefore not available to the live professor model.

## How to use this reference

- Start with [Capability index](capability-index.md) for a plain list of supported and unsupported jobs.
- Use [Runtime and scope](runtime-and-scope.md) to understand authentication, course selection, persistence, model steps, and result visibility.
- Use [Read tools](read-tools.md) for exact request parameters, database reads, calculations, and return shapes.
- Use [Write tools](write-tools.md) for the direct-action registry and shared return contract.
- Use [Content and policy actions](write-content-actions.md), [grade and session actions](write-grade-session-actions.md), and [review and deletion actions](write-review-delete-actions.md) for action-level parameters, database mutations, and side effects.
- Use [Draft tools](draft-tools.md) for the separate proposal and Review path.
- Use [Database access](database-access.md) for a table-oriented access matrix.
- Use [Shared schemas](shared-schemas.md) for reusable question, rubric, result, and error contracts.

## Change discipline

When a tool is added, removed, or changed:

1. Change the Zod schema and executor in code.
2. Update only the relevant tool document and database matrix row.
3. Update the registry and capability tables in this README and `capability-index.md`.
4. Update `lib/workspace/agent-tools-docs-contract.test.ts` when the set of tools, resources, actions, or skills changes.
5. Do not document a capability unless a current source path and symbol prove it.

## Source-of-truth files

| Concern | Source |
| --- | --- |
| Live tool registry and direct LMS operations | [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) |
| Draft tool contracts | [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts) |
| Shared proposal block schemas | [`lib/agent/blocks.ts`](../../lib/agent/blocks.ts) |
| Rubric normalization | [`lib/agent/rubric-proposal.ts`](../../lib/agent/rubric-proposal.ts) |
| Runtime assembly and model step limit | [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts) |
| API authentication and request limits | [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts) |
| Course and term selection | [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts) |
| Table definitions and foreign keys | [`lib/db/schema.ts`](../../lib/db/schema.ts) |
| Skill allowlist and file containment | [`lib/agent/atlas-harness.ts`](../../lib/agent/atlas-harness.ts) and [`.atlas/manifest.json`](../../.atlas/manifest.json) |
