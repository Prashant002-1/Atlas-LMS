# ADR-0013: Professor agent as the LMS operator

Status: accepted

Date: 2026-07-15

## Context

ADR-0012 shipped a deliberately narrow professor harness with five tools. It could inspect selected course content and class-level AI assignment results, but it could not answer ordinary professor questions such as the class grade distribution or one student's grades. It also rendered a run trace for every assistant turn, even when the teacher only needed an answer.

That boundary was wrong for the product. The LMS is the working environment and Atlas is the agent that operates it. A professor should not have to leave the conversation for records Atlas can already access through the application.

## Decision

The professor runtime uses a course-wide typed operator surface:

- inspect_lms reads the roster, assignments, modules, pages, files, announcements, practice sets, submissions, assessed sessions, rubrics, policies, calendar facts, and drafts.
- read_gradebook computes course and assignment distributions and reads assignment or individual student grade records.
- search_course searches content and roster identity when the request starts from words instead of an id.
- Exact per-action tools perform ordinary LMS operations through one shared scoped executor, including record creation and editing, publishing, announcements, grades, missing states, policy and session-contract changes, draft decisions, session grading, class-result refreshes, and exactly confirmed deletion.
- The existing AI assignment, rubric, and course draft tools remain available for work that belongs in Review.

The model never receives arbitrary SQL. Authorization remains structural. Each executor receives the authenticated organization, instructor, and course identifiers and repeats organization and course predicates in every query and mutation.

The stream may take up to 16 model steps so multi-record work can complete in one turn. User and assistant turns continue to use the turn-persisted AI SDK 7 runtime from ADR-0010.

## Grade distribution semantics

Course distribution uses active student enrollment currentScore values. Null scores are ungraded and excluded from the numeric distribution while the enrolled and graded denominators remain explicit.

Assignment distribution converts graded raw scores to percentages using that assignment's pointsPossible. It reports count, average, median, minimum, maximum, and A/B/C/D/F bands. The calculation is deterministic and unit tested.

## Interface

The conversation no longer renders an always-present run trace. AI Elements are used as follows:

- Loader is visible only while the model is thinking or a tool is active.
- Completed reads disappear into the answer.
- Direct writes produce one small changed-record receipt.
- Draft artifacts remain visible because they are the work product.
- Tool errors remain expandable with parameters so a teacher can understand a failure that needs attention.

No hidden chain-of-thought is exposed.

## Consequences

Atlas can answer the two baseline capability checks directly:

- What is the grade distribution for the class?
- How is Maya Patel doing?

The direct mutation surface is intentionally broad. The lasting safety boundary is scoped typed execution, not model prompting. Later policy work can add approval modes by operation without removing read capability or rebuilding the operator contract.
