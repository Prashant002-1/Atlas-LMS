# Capability index

This index answers "can Atlas do X?" for the professor agent in PR #34.

## Supported now

| Job | Supported? | How |
| --- | --- | --- |
| Count the course's students and LMS objects | Yes | `inspect_lms { resource: "overview" }` |
| Read course name, description, syllabus, dates, status, or time zone | Yes | `inspect_lms { resource: "course" }` |
| List or search active students | Yes | `inspect_lms { resource: "students", query? }` or `search_course` students |
| Read one active student's current/final standing | Yes | `inspect_lms.students` or `read_gradebook { view: "student" }` |
| Read one student's assignment grades, missing work, open work, responses, and timestamps | Yes | `read_gradebook { view: "student", studentId or studentQuery }` |
| Disambiguate duplicate student names | Yes | student view returns exact id/name/email matches and requires a follow-up id |
| Compute course grade distribution | Yes | `read_gradebook { view: "distribution" }` over active enrollment `currentScore` |
| Compute assignment grade distribution | Yes | same view with `assignmentId`; converts raw points to percent |
| Compare one assignment across the class | Yes | `read_gradebook { view: "assignment", assignmentId }` |
| Summarize every active student's graded/submitted/missing/open counts | Yes | `read_gradebook { view: "students" }` |
| Read ordinary submissions and response bodies | Yes | `inspect_lms { resource: "submissions" }` |
| Read assessed session submissions, reports, rubric scores, transcript, and final artifact | Yes | `inspect_lms { resource: "sessions" }`; transcript/artifact detail requires exact submission `ids` or assignment plus student |
| Read stored class results for AI assignments | Yes | `inspect_lms { resource: "class_results" }` |
| Recompute class results | Yes | `refresh_class_results` |
| Read rubrics and AI assignment policies | Yes | `inspect_lms` resources `rubrics` and `policies` |
| Read assignments, modules, module items, pages, files, announcements, quizzes, and practice sets | Yes | corresponding `inspect_lms` resource |
| Search assignment, module, page, file, announcement, and student text | Yes | `search_course`; case-insensitive substring search |
| Read calendar-relevant due and unlock dates | Yes | `inspect_lms { resource: "calendar" }` |
| Read drafts and professor threads | Yes | `inspect_lms` resources `drafts` and `threads` |
| Create, edit, publish, or unpublish an assignment | Yes | `create_assignment`, `update_assignment`, `publish_assignment` |
| Create, edit, publish, or unpublish a module | Yes | `create_module`, `update_module`, `publish_module` |
| Create or edit a page | Yes | `create_page`, `update_page` |
| Post an announcement | Yes, immediate | `post_announcement` |
| Create a practice set | Yes, immediate | `create_practice_set` |
| Edit course name, description, or syllabus | Yes | `update_course` |
| Edit course AI policy | Yes | `update_course_policy` |
| Set or replace a student's grade | Yes | `set_grade`; upserts gradebook row and refreshes standing |
| Mark or clear missing | Yes | `mark_missing` within its submission-state checks |
| Edit AI assignment instructions, duration, grounding labels, transcript policy, or personal-note toggle | Yes | `update_session_contract` |
| Grade or regrade an assessed session | Yes | `grade_session` |
| Finalize a draft session grade into the classic gradebook | Yes | `finalize_session_grade` |
| Draft a new AI assignment | Yes, through Review | `draft_ai_assignment`, then `apply_draft` |
| Draft a rubric revision | Yes, through Review | `draft_rubric`, then `apply_draft` |
| Draft modules, assignments, pages, announcements, practice sets, or objectives | Yes, through Review | `draft_course`, then `apply_draft` |
| Apply or dismiss a pending Atlas draft | Yes | `apply_draft`, `dismiss_draft` |
| Delete an assignment, module, page, announcement, or practice set | Yes, immediate | `delete_record` with exact current title confirmation |
| Load a reviewed workflow | Yes | `load_skill` for one of six allowlisted skill ids |

## Not exposed by the current tool contracts

| Job | Supported? | Source-backed reason |
| --- | --- | --- |
| Choose another organization or course inside a tool call | No | scope is closed over from the authenticated route; tool schemas have no org or course parameter |
| Read another organization or unselected course | No | executors repeat organization and current-course predicates |
| Use arbitrary SQL | No | no SQL-string input or SQL execution tool is returned by `professorOperatorTools` |
| Use shell, filesystem mutation, browser, web search, HTTP, email, or general code execution | No | no such tool is in the returned registry |
| Expose provider keys or credentials | No | model resolution happens before tools and returns a model object, not key data |
| Create or edit a quiz row | No | quizzes are read-only in `inspect_lms`; no quiz mutation action exists |
| Create or edit a module item | No | module items are read-only in `inspect_lms` |
| Upload, create, edit, or delete a file row | No | files are read/search only |
| Add, remove, or edit a student enrollment | No | no enrollment mutation action exists |
| Edit or unpublish an existing announcement | No | direct actions can post and exact-title delete; no announcement-update action exists |
| Edit an existing practice set or toggle its publish state | No | direct actions can create and exact-title delete; no practice-set update action exists |
| Edit a submission response body or submission timestamps directly | No | submission mutation is limited to grade, missing state, and session finalization fields |
| Directly edit rubric criteria | No | rubric changes use `draft_rubric` plus apply |
| Directly edit AI assignment side-note trigger JSON | No | `update_session_contract` does not include `sideNoteTriggers` |
| Reopen a finalized session report as a dedicated action | No | `grade_session { force: true }` can replace it with a new draft, but there is no separate reopen contract |
| Calculate weighted assignment-group course grades | No | distribution uses stored enrollment standing or raw assignment points; `assignment_groups.groupWeight` is not read by `read_gradebook` |
| Use `course_grade_snapshots` for trend analysis | No | no live tool reads that table |
| Read or manage `calendar_events` | No | calendar reads are derived from assignment due dates and module unlock dates |
| Search semantically with embeddings | No | `search_course` uses SQL `ILIKE`; it does not call the embedding pipeline |
| Run more than 16 model steps in one turn | No | `isStepCount(16)` ends the run |
| Send one bulk mutation payload containing many actions | No | Each direct action tool accepts one exact operation; the model may make multiple tool calls within the step ceiling |
| Require human approval for every direct mutation | No | Direct action tools execute when called. Review applies only to the three draft tools |
| Automatically revalidate Next.js routes after direct tool writes | No | Direct action tools perform database writes but do not call `revalidatePath` |
| Expose the old `inspect_course` tool | No | it exists in `professorTools`, but the live operator registry does not return it |

## Important data-boundary details

- `inspect_lms.students` and all `read_gradebook` views use active student enrollments.
- `inspect_lms.submissions` and `inspect_lms.sessions` scope by organization and course but do not add an active-enrollment predicate. They can therefore return scoped historic rows for students no longer active when such rows exist.
- Instructor context includes unpublished course content. Individual student grade view also includes every scoped assignment, including unpublished assignments; its `open` count only counts published assignments.
- `read_gradebook` course distribution trusts stored `enrollments.currentScore`; it does not recalculate standing from submission rows.
- `set_grade` does recalculate the selected student's current standing from graded, non-missing submission rows with positive points possible.
- `grade_session` stores a draft report. Only `finalize_session_grade` writes that report score into the classic gradebook.

Proof: [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), and [`lib/agent/professor-tools.ts`](../../lib/agent/professor-tools.ts).
