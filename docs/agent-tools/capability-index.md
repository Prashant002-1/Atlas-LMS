# Capability index

This index answers "can Atlas do X?" for the live professor and personal student agents.

## Supported now

| Job | Supported? | How |
| --- | --- | --- |
| Read course, roster, content, files, submissions, sessions, rubrics, policies, calendar facts, drafts, and chats | Yes | the matching `inspect_lms` resource |
| Search assignments, modules, pages, files, announcements, and students | Yes | `search_course` |
| Search current public web sources | When server policy permits it | `search_web` returns bounded excerpts and citation URLs |
| Read course, assignment, roster, or individual-student grade data | Yes | `read_gradebook` |
| Compute course or assignment grade distributions | Yes | `read_gradebook { view: "distribution" }` |
| Create, edit, publish, or unpublish an assignment | Yes | `create_assignment`, `update_assignment`, `publish_assignment` |
| Create, edit, publish, or unpublish a module | Yes | `create_module`, `update_module`, `publish_module` |
| Create or edit a page | Yes | `create_page`, `update_page` |
| Post an announcement | Yes | `post_announcement` |
| Create a practice set | Yes | `create_practice_set` |
| Edit course name, description, or syllabus | Yes | `update_course` |
| Set or replace a student's grade | Yes | `set_grade` |
| Mark or clear missing | Yes | `mark_missing` |
| Edit an AI assignment contract | Yes | `update_session_contract` |
| Grade or regrade an assessed session | Yes | `grade_session` |
| Finalize a draft session grade | Yes | `finalize_session_grade` |
| Recompute stored class results | Yes | `refresh_class_results` |
| Apply or dismiss a pending draft | Yes | `apply_draft`, `dismiss_draft` |
| Delete a supported course record | Yes | `delete_record` with exact current title confirmation |
| Configure the shared course agent's name, voice, teaching behavior, boundaries, disclosure, and rules | Yes | `configure_agent`; append-only versioned write |
| Draft a new AI assignment | Yes, through Review | `draft_ai_assignment`, then `apply_draft` |
| Draft a rubric revision | Yes, through Review | `draft_rubric`, then `apply_draft` |
| Draft coordinated course records | Yes, through Review | `draft_course`, then `apply_draft` |
| Load a reviewed workflow | Yes | `load_skill` for one of six allowlisted skill ids |
| Attach documents to a professor conversation | Yes | authenticated UI intake reuses Materials storage; the user turn persists scoped attachment ids and only ready readable content reaches model context |
| Attach private documents to a student's personal Atlas | Yes | the file and processing record belong to the student with no course id; exact organization, student, and personal-session checks protect viewing and context |

Teacher Materials can also upload or link course material through its separate scoped server actions. That intake is not a model-visible tool.

## Not exposed by the current tool contracts

| Job | Supported? | Source-backed reason |
| --- | --- | --- |
| Choose another organization or course inside a tool call | No | scope is closed over from the authenticated route |
| Read another organization or unselected course | No | executors repeat organization and current-course predicates |
| Use arbitrary SQL | No | no SQL-string input or SQL execution tool exists |
| Use shell, filesystem mutation, browser control, arbitrary HTTP, email, or general code execution | No | `search_web` accepts only a query and calls one fixed server-owned search endpoint |
| Expose platform credentials, model settings, or endpoints | No | model resolution happens before tools and platform details are absent from course-actor settings |
| Expand authority through course agent configuration | No | configuration changes teaching behavior only; fixed tools and scopes remain authoritative |
| Replace fixed assignment or grading rules through course configuration | No | assessed-session rules and assignment contracts compile before course configuration |
| Create or edit a quiz row | No | quizzes are read-only in `inspect_lms`; no quiz mutation action exists |
| Create or edit a module item | No | module items are read-only in `inspect_lms` |
| Ask the model to fetch or parse an arbitrary file itself | No | document intake is an authenticated application action; the model receives only ready, access-checked readable artifacts |
| Add, remove, or edit a student enrollment | No | no enrollment mutation action exists |
| Directly edit rubric criteria | No | rubric changes use `draft_rubric` plus apply |
| Calculate weighted assignment-group course grades | No | grade distributions use stored course standing or raw assignment points |
| Search semantically with embeddings | No | `search_course` uses SQL substring search |
| Run more than 16 model steps in one turn | No | `isStepCount(16)` ends the run |
| Send one bulk mutation payload containing many actions | No | Each direct action tool accepts one exact operation; the model may make multiple tool calls within the step ceiling |
| Automatically revalidate Next.js routes after direct tool writes | No | Direct action tools perform database writes but do not call `revalidatePath` |
| Expose the old `inspect_course` tool | No | it exists in `professorTools`, but the live operator registry does not return it |

## Important boundaries

- The active course agent configuration is loaded into each professor turn and each student assessed-session turn.
- Course configuration is append-only, attributed, versioned, and guarded by expected-version concurrency.
- Student session course material includes only ready, course-visible content. Instructor context may describe processing and instructor-only materials.
- `set_grade` recalculates the selected student's current standing from graded, non-missing rows with positive points possible.
- `grade_session` stores a draft report. Only `finalize_session_grade` writes that report score into the classic gradebook.

Proof: [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts), [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts), [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts), and [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts).
