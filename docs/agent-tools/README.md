# Atlas professor agent tool contracts

This directory is the source-backed reference for the live professor-agent surface. It describes executable code, not intended future behavior.

## Current tool registry

The runtime exposes exactly 28 tools. Twenty direct LMS writes are separate exact-schema tools so providers do not need to accept a top-level union schema. Shared teaching policy is written through the append-only `configure_agent` tool.

| Tool | Kind | Purpose | Contract |
| --- | --- | --- | --- |
| `inspect_lms` | Read | Read scoped LMS data by resource | [Read tools](read-tools.md#inspect_lms) |
| `read_gradebook` | Read and calculate | Read course, assignment, roster, or individual student grade data | [Read tools](read-tools.md#read_gradebook) |
| `search_course` | Read | Case-insensitive text search across selected course data | [Read tools](read-tools.md#search_course) |
| `load_skill` | Filesystem read | Load one reviewed workflow from `.atlas/skills` | [Read tools](read-tools.md#load_skill) |
| `configure_agent` | Versioned configuration write | Replace the shared course agent's typed teaching configuration | [Course agent configuration](course-agent-configuration.md) |
| `create_assignment`, `update_assignment`, `publish_assignment` | Direct write | Create, edit, publish, or unpublish assignments | [Content actions](write-content-actions.md#assignment-actions) |
| `create_module`, `update_module`, `publish_module` | Direct write | Create, edit, publish, or unpublish modules | [Content actions](write-content-actions.md#module-actions) |
| `create_page`, `update_page`, `post_announcement`, `create_practice_set` | Direct write | Change ordinary course content immediately | [Content actions](write-content-actions.md) |
| `update_course` | Direct write | Change course record fields immediately | [Content actions](write-content-actions.md#course-action) |
| `set_grade`, `mark_missing`, `update_session_contract` | Direct write | Change grades, submission state, or an AI assignment contract | [Grade and session actions](write-grade-session-actions.md) |
| `grade_session`, `finalize_session_grade`, `refresh_class_results` | Direct write | Run assessed-session and class-result operations | [Grade and session actions](write-grade-session-actions.md) |
| `apply_draft`, `dismiss_draft`, `delete_record` | Direct write | Decide a reviewed draft or delete an exactly confirmed record | [Review and deletion actions](write-review-delete-actions.md) |
| `draft_ai_assignment` | Draft write | Store an AI assignment proposal for Review | [Draft tools](draft-tools.md#draft_ai_assignment) |
| `draft_rubric` | Draft write | Store a rubric revision proposal for Review | [Draft tools](draft-tools.md#draft_rubric) |
| `draft_course` | Draft write | Store up to six course-object proposals for Review | [Draft tools](draft-tools.md#draft_course) |

Proof: `professorOperatorTools` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) returns the read, exact direct-action, and draft tools. `directActionTools` derives exact schemas from the internal mutation branches. `runProfessorTurn` adds `configure_agent` from [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts) to the same closed registry.

`inspect_course` still exists inside `professorTools`, but the live runtime does not return it.

## How to use this reference

- Start with [Capability index](capability-index.md) for supported and unsupported jobs.
- Use [Runtime and scope](runtime-and-scope.md) for authentication, course selection, persistence, limits, and result visibility.
- Use [Read tools](read-tools.md) for request parameters, database reads, calculations, and return shapes.
- Use [Write tools](write-tools.md) for the direct-action registry and shared return contract.
- Use [Course agent configuration](course-agent-configuration.md) for the shared professor-to-student configuration contract.
- Use [Content actions](write-content-actions.md), [grade and session actions](write-grade-session-actions.md), and [review and deletion actions](write-review-delete-actions.md) for action-level behavior.
- Use [Draft tools](draft-tools.md) for the proposal and Review path.
- Use [Database access](database-access.md) for the table-oriented matrix.
- Use [Shared schemas](shared-schemas.md) for reusable question, rubric, result, and error contracts.

## Change discipline

When a tool is added, removed, or changed:

1. Change the Zod schema and executor in code.
2. Update the relevant tool document and database matrix row.
3. Update the registry and capability tables.
4. Update `lib/workspace/agent-tools-docs-contract.test.ts` when tools, resources, actions, or skills change.
5. Do not document a capability unless a current source path and symbol prove it.

## Source-of-truth files

| Concern | Source |
| --- | --- |
| LMS tools and direct operations | [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts) |
| Course agent configuration tool | [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts) |
| Configuration schema, compiler, versioning, and provenance | [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts) |
| Draft tools | [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts) |
| Runtime assembly and step limit | [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts) |
| API authentication and request limits | [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts) |
| Course and term selection | [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts) |
| Academic database schema | [`lib/db/schema.ts`](../../lib/db/schema.ts) |
| Agent configuration and material metadata schema | [`lib/db/course-agent-schema.ts`](../../lib/db/course-agent-schema.ts) |
| Skill allowlist and file containment | [`lib/agent/atlas-harness.ts`](../../lib/agent/atlas-harness.ts) and [`.atlas/manifest.json`](../../.atlas/manifest.json) |
