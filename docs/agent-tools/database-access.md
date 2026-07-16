# Database access matrix

This is a table-oriented view of every database touch in the professor-agent request path and live tool registry.

## Scope predicates

The main LMS tables carry `orgId` and `courseId`. Tool code repeats both predicates where both columns exist.

Additional scope rules:

- student reads and grade writes join or check active `enrollments` with role `student`;
- professor thread reads require `agent_sessions.userId = scope.instructorId`, surface `command`, and anchor type `course`;
- current course selection happens before tool creation and cannot be overridden by a model parameter;
- joined `assignments`, `users`, and `rubrics` tables receive their own organization and course predicates in the relevant joins.

Proof: [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), and [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts).

## Runtime access outside explicit tools

| Stage | Reads | Writes |
| --- | --- | --- |
| authenticate and choose course | auth/session storage through `auth`; `terms`, `courses`, `enrollments` through `resolveScope` | cookies are read, not changed by this route |
| short-term turn budget | `agent_turns` joined to `agent_sessions` | none |
| model resolution | `org_provider_keys` through `resolveModelForOrg`, with environment fallback implemented in that module | none |
| create or load professor thread | `agent_sessions` | may insert `agent_sessions`; may update thread title |
| persist user turn | `agent_sessions` state | inserts `agent_turns`; updates `agent_sessions` counters/timestamps |
| build base instructor context | `courses`, `terms`, `course_ai_policies`, `learning_objectives`, `modules`, `assignments`, `pages`, recent `announcements`, `content_alignments`, `enrollments`, `submissions` | none |
| extend professor context | `session_assignments`, `rubrics`, pending `change_proposals` | none |
| load conversation | `agent_turns`, `agent_sessions.summary` | none |
| persist assistant turn | `agent_sessions` state | inserts `agent_turns`; updates `agent_sessions` counters/timestamps |
| compaction when needed | active `agent_turns`, `agent_sessions` | updates `agent_sessions.summary` and compaction cursor |

Proof: [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), [`lib/agent/context.ts`](../../lib/agent/context.ts), [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), [`lib/agent/session.ts`](../../lib/agent/session.ts), and [`lib/agent/session-store.ts`](../../lib/agent/session-store.ts).

## Read-tool table matrix

| Tool or resource | Tables read | Tables written |
| --- | --- | --- |
| `inspect_lms.overview` | `enrollments`, `assignments`, `modules`, `pages`, `files`, `announcements`, `practice_sets`, `submissions`, `session_submissions`, `change_proposals` | none |
| `inspect_lms.course` | `courses` | none |
| `inspect_lms.students` | `enrollments`, `users` | none |
| `inspect_lms.assignments` | `assignments` | none |
| `inspect_lms.modules` | `modules` | none |
| `inspect_lms.module_items` | `module_items` | none |
| `inspect_lms.pages` | `pages` | none |
| `inspect_lms.files` | `files` | none |
| `inspect_lms.announcements` | `announcements` | none |
| `inspect_lms.quizzes` | `quizzes` | none |
| `inspect_lms.practice_sets` | `practice_sets` | none |
| `inspect_lms.submissions` | `submissions`, `assignments`, `users` | none |
| `inspect_lms.sessions` | `session_submissions`, `assignments`, `users`, optional `journey_reports` | none |
| `inspect_lms.class_results` | `class_rollups`, `assignments` | none |
| `inspect_lms.rubrics` | `session_assignments`, `assignments`, `rubrics` | none |
| `inspect_lms.policies` | `course_ai_policies`, `session_assignments`, `assignments` | none |
| `inspect_lms.calendar` | `assignments`, `modules` | none |
| `inspect_lms.drafts` | `change_proposals` | none |
| `inspect_lms.threads` | `agent_sessions` | none |
| `read_gradebook`, all views | `enrollments`, `users`; selected views additionally read `assignments`, `submissions` | none |
| `search_course` | selected subset of `assignments`, `modules`, `pages`, `files`, `announcements`; student search also reads `enrollments`, `users` | none |
| `load_skill` | no database tables; reads `.atlas/manifest.json` and one `.atlas/skills/*/SKILL.md` file | none |

Proof: read executors in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).

## Direct-write table matrix

| `mutate_lms.action` | Tables read | Tables inserted | Tables updated | Tables deleted |
| --- | --- | --- | --- | --- |
| `create_assignment` | `assignments` for max position | `assignments` | none | none |
| `update_assignment` | `assignments` target | none | `assignments` | none |
| `publish_assignment` | `assignments` target | none | `assignments` | none |
| `create_module` | `modules` for max position | `modules` | none | none |
| `update_module` | `modules` target | none | `modules` | none |
| `publish_module` | `modules` target | none | `modules` | none |
| `create_page` | `pages` slugs | `pages` | none | none |
| `update_page` | `pages` target | none | `pages` | none |
| `post_announcement` | none | `announcements` | none | none |
| `create_practice_set` | `practice_sets` for max position | `practice_sets` | none | none |
| `update_course` | `courses` target | none | `courses` | none |
| `update_course_policy` | `course_ai_policies` | `course_ai_policies` when absent | `course_ai_policies` on conflict | none |
| `set_grade` | `assignments`, `enrollments`, `users`; standing refresh also reads `submissions` joined to `assignments` | `submissions` when absent | `submissions` on conflict; `enrollments` standing | none |
| `mark_missing` | `assignments`, `enrollments`, `users`, existing `submissions` | `submissions` when absent | `submissions` on conflict | none |
| `update_session_contract` | `session_assignments`, `assignments` | none | `session_assignments` | none |
| `apply_draft` | `change_proposals`, `proposal_blocks`, then block-specific target tables | block-specific live rows | `proposal_blocks`, `change_proposals`, plus block-specific updates | none |
| `dismiss_draft` | `change_proposals` | none | `proposal_blocks`, `change_proposals` | none |
| `grade_session` | `session_submissions`, `rubrics`, `journey_reports`, then rollup reads | `evidence_spans`, `journey_reports`, and upsert `class_rollups` | `class_rollups` on conflict | prior `evidence_spans` and `journey_reports` for that submission when grading runs |
| `finalize_session_grade` | `journey_reports`, `session_submissions`, `users`, existing classic `submissions`; standing refresh reads `submissions`, `assignments` | classic `submissions` when absent | `journey_reports`, `session_submissions`, classic `submissions`, `enrollments` standing | none |
| `refresh_class_results` | `assignments`, `journey_reports`, `session_submissions`, `session_side_notes` | `class_rollups` when absent | `class_rollups` on conflict | none |
| `delete_record` | one selected target table | none | none | one row from `assignments`, `modules`, `pages`, `announcements`, or `practice_sets`; declared foreign-key cascades may delete or null dependent rows |

Proof: `mutateLms` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), grading in [`lib/agent/grading.ts`](../../lib/agent/grading.ts), rollup in [`lib/agent/rollup.ts`](../../lib/agent/rollup.ts), and proposal application in [`lib/agent/apply.ts`](../../lib/agent/apply.ts).

## Draft-tool table matrix

| Tool | Tables read | Tables inserted | Live course rows changed immediately? |
| --- | --- | --- | --- |
| `draft_ai_assignment` | `assignments`, `session_assignments`, pending assignment-kind `change_proposals` | `change_proposals`, `proposal_blocks` | no |
| `draft_rubric` | `session_assignments`, `assignments`, `rubrics`, pending rubric-kind `change_proposals` | `change_proposals`, `proposal_blocks` | no |
| `draft_course` | none before its transaction, apart from schema validation in memory | `change_proposals`, `proposal_blocks` | no |

Both AI assignment and rubric drafts take a transaction advisory lock before duplicate checks and insert. `draft_course` does not.

Proof: [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).

## Apply-time live table matrix by block

| Proposal block | Tables read | Tables inserted or updated |
| --- | --- | --- |
| `objective` | `learning_objectives` | inserts `learning_objectives` only if code is absent |
| `module` | `modules`, matching `learning_objectives` | inserts `modules`; inserts `content_alignments` for matching codes |
| `assignment` | `assignments`, `courses`, `terms`, matching `learning_objectives` | inserts `assignments`; inserts `content_alignments` |
| `page` | `pages`, matching `learning_objectives` | inserts `pages`; inserts `content_alignments` |
| `announcement` | none beyond proposal data | inserts `announcements` |
| `practice_set` | `practice_sets`, matching `learning_objectives` | inserts `practice_sets`; inserts `content_alignments` |
| `ai_assignment` | target `assignments`, existing `session_assignments`, max course rubric version | inserts `rubrics`; inserts `session_assignments` |
| `session_rubric` | target `session_assignments` joined to `assignments`, max course rubric version | inserts `rubrics`; updates `session_assignments.rubricId` |

Every processed proposal block is then updated with applied state and optional applied item type/id. The proposal is updated to applied.

## Tables the live tools do not query directly

The live operator registry has no executor that directly queries or mutates:

- auth `accounts`, `sessions`, or `verification_tokens`;
- `organizations`;
- `program_outcomes` or `objective_outcome_map`;
- `course_grade_snapshots`;
- `calendar_events`;
- `org_provider_keys` as a model-visible tool. Model resolution reads provider configuration before the tool registry is created, and keys are not returned to the model.

Some of these tables may be touched by authentication or model-resolution infrastructure outside model-visible tools, as noted above.
