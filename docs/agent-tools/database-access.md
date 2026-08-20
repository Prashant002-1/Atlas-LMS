# Database access matrix

This is the table-oriented view of database access in the professor-agent request path, teacher Materials, and personal student attachments.

## Scope predicates

- Current organization, instructor, and course are resolved before tools are created.
- Tool schemas do not accept organization or course identifiers.
- LMS executors repeat organization and course predicates.
- Student reads and grade writes additionally verify active course enrollment.
- Professor chat reads require the current instructor, command surface, and course anchor.
- Course agent configuration writes verify the source chat against the same organization, course, instructor, surface, and anchor.

Proof: [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts), [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), and [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts).

## Runtime access outside explicit tools

| Stage | Reads | Writes |
| --- | --- | --- |
| authenticate and choose course | authentication state, `terms`, `courses`, `enrollments` | none |
| model resolution | server environment configuration only | none |
| create or load professor chat | `agent_sessions` | may insert `agent_sessions`; may update title |
| persist turns | `agent_sessions` | inserts `agent_turns`; updates counters and timestamps |
| build professor context | course academic tables, `files`, `course_material_records`, `course_agent_configs`, `course_agent_directives`, AI assignment contracts, rubrics, drafts | none |
| compaction | active `agent_turns`, `agent_sessions` | updates session summary and cursor |

Platform credentials are never returned to model-visible tools or teacher Settings.

## Model-visible tools

| Tool | Main reads | Main writes |
| --- | --- | --- |
| `inspect_lms` | selected course tables by resource | none |
| `read_gradebook` | `enrollments`, `users`, `assignments`, `submissions` as required by view | none |
| `search_course` | selected course content tables and active roster | none |
| 20 direct action tools | action-specific scoped rows | one typed action across content, grades, sessions, drafts, or deletion |
| `load_skill` | reviewed `.atlas` files | none |
| `configure_agent` | current `course_agent_configs` version | inserts `change_proposals`, `proposal_blocks` |
| `inspect_course_guidance` | latest `course_agent_directives` revisions | none |
| `propose_course_guidance` | latest directive revisions | inserts `change_proposals`, `proposal_blocks` |
| `draft_ai_assignment` | assignment and pending-draft rows | inserts `change_proposals`, `proposal_blocks` |
| `draft_rubric` | assignment, session contract, rubric, and pending-draft rows | inserts `change_proposals`, `proposal_blocks` |
| `draft_course` | validated in-memory draft | inserts `change_proposals`, `proposal_blocks` |

The exact 20 direct action tools are documented in [Write tools](write-tools.md). Their action-level data changes are documented in [content actions](write-content-actions.md), [grade and session actions](write-grade-session-actions.md), and [review and deletion actions](write-review-delete-actions.md).

## Course agent configuration

Course agent write tools create proposals. Applying them writes append-only policy state:

| Step | Reads | Writes |
| --- | --- | --- |
| draft configuration | latest `course_agent_configs.version` | one proposal and typed configuration block |
| draft guidance | latest revision for each directive key | one proposal and one typed block per key |
| apply configuration | `agent_sessions`, latest configuration version | one new `course_agent_configs` row |
| apply guidance | latest directive revision per key | one new `course_agent_directives` row per block |

It never updates or deletes a prior configuration or directive revision. The stored policy cannot grant database authority.

Proof: [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts) and [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts).

## Course material intake outside the model

Teacher Materials and personal student document intake use authenticated server actions, not model tools:

| Action | External work | Database work |
| --- | --- | --- |
| upload supported document | parses bounded bytes locally with AnyDoc or strict UTF-8 | transaction inserts `files`, `document_originals`, `course_material_records`, and its attachment; failed readable conversion still preserves the original |
| upload other material | none; the bytes are not parsed | transaction stores the private original and inserts a ready `files`, `course_material_records`, and attachment record |
| add linked material | none; Atlas does not fetch the URL | transaction stores the validated HTTPS URL in a ready `files` and `course_material_records` record |
| change material access | none | updates or creates one `course_material_records` extension row |
| attach a personal student document | parses bounded bytes locally with the same document adapter | inserts one student-owned `files` row, private original, private processing record, and exact personal-session attachment with no course id |

Local document intake stores the original and either a ready canonical Markdown result or a failed readable state in one transaction. Other uploads are stored unchanged and marked ready. Links are references only. Existing course `files` rows without an extension row resolve as ready, course-visible LMS material. Personal rows require a private processing record and exact student/session ownership.

Proof: [`lib/course/documents.ts`](../../lib/course/documents.ts), [`lib/course/document-parser.ts`](../../lib/course/document-parser.ts), [`lib/instructor/course-material-actions.ts`](../../lib/instructor/course-material-actions.ts), [`lib/course/materials.ts`](../../lib/course/materials.ts), and [`lib/db/course-agent-schema.ts`](../../lib/db/course-agent-schema.ts).
