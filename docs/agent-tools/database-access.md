# Database access matrix

This is the table-oriented view of database access in the professor-agent request path and the Course Setup material path.

## Scope predicates

- Current organization, instructor, and course are resolved before tools are created.
- Tool schemas do not accept organization or course identifiers.
- LMS executors repeat organization and course predicates.
- Student reads and grade writes additionally verify active course enrollment.
- Professor thread reads require the current instructor, command surface, and course anchor.
- Course agent configuration writes verify the source thread against the same organization, course, instructor, surface, and anchor.

Proof: [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts), [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), and [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts).

## Runtime access outside explicit tools

| Stage | Reads | Writes |
| --- | --- | --- |
| authenticate and choose course | authentication state, `terms`, `courses`, `enrollments` | none |
| model resolution | `org_provider_keys` or environment fallback | none |
| create or load professor thread | `agent_sessions` | may insert `agent_sessions`; may update title |
| persist turns | `agent_sessions` | inserts `agent_turns`; updates counters and timestamps |
| build professor context | course academic tables, `files`, `course_material_records`, `course_agent_configs`, AI assignment contracts, rubrics, drafts | none |
| compaction | active `agent_turns`, `agent_sessions` | updates session summary and cursor |

Provider records are never returned to model-visible tools or teacher Settings.

## Model-visible tools

| Tool | Main reads | Main writes |
| --- | --- | --- |
| `inspect_lms` | selected course tables by resource | none |
| `read_gradebook` | `enrollments`, `users`, `assignments`, `submissions` as required by view | none |
| `search_course` | selected course content tables and active roster | none |
| `mutate_lms` | action-specific scoped rows | one typed action across content, grades, sessions, drafts, or deletion |
| `load_skill` | reviewed `.atlas` files | none |
| `configure_agent` | `agent_sessions`, current `course_agent_configs` version | inserts one `course_agent_configs` row |
| `draft_ai_assignment` | assignment and pending-draft rows | inserts `change_proposals`, `proposal_blocks` |
| `draft_rubric` | assignment, session contract, rubric, and pending-draft rows | inserts `change_proposals`, `proposal_blocks` |
| `draft_course` | validated in-memory draft | inserts `change_proposals`, `proposal_blocks` |

The exact 21 `mutate_lms` actions are documented in [Write tools](write-tools.md). Their action-level data changes are documented in [content and policy actions](write-content-actions.md), [grade and session actions](write-grade-session-actions.md), and [review and deletion actions](write-review-delete-actions.md).

## Course agent configuration

`configure_agent` writes append-only policy state:

| Step | Reads | Writes |
| --- | --- | --- |
| source verification | `agent_sessions` | none |
| concurrency check | latest `course_agent_configs.version` | transaction advisory lock only |
| successful change | none after validation | one new `course_agent_configs` row |

It never updates or deletes a prior version. The stored configuration cannot grant database authority.

Proof: [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts) and [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts).

## Course material intake outside the model

Teacher Course Setup uses authenticated server actions, not model tools:

| Action | External work | Database work |
| --- | --- | --- |
| upload material | forwards a bounded file to the configured HTTPS ingestion service | transaction inserts `files` plus `course_material_records` |
| add linked material | asks the ingestion service to process one HTTPS URL | transaction inserts `files` plus `course_material_records` |
| signed ingestion callback | worker sends HMAC-signed job status and extraction data | updates the scoped `files` and `course_material_records` rows for that job |
| change material access | none | updates or creates one `course_material_records` extension row |

If initial ingestion fails, no database row is created. Asynchronous work is correlated by a stable unique job id. Existing `files` rows without an extension row resolve as ready, course-visible LMS material.

Proof: [`lib/instructor/course-material-actions.ts`](../../lib/instructor/course-material-actions.ts), [`lib/course/materials.ts`](../../lib/course/materials.ts), [`app/api/materials/ingestion/route.ts`](../../app/api/materials/ingestion/route.ts), and [`lib/db/course-agent-schema.ts`](../../lib/db/course-agent-schema.ts).
