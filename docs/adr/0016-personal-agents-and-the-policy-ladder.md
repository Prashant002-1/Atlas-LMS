# ADR-0016: Personal agents and the policy ladder

Date: 2026-07-23
Status: Accepted

## Context

Atlas shipped three agent surfaces before this decision: the professor's course
operator (`/teach/atlas`), the assessed assignment session, and the course agent
configuration that governs how the assignment session teaches. The student had
no Atlas of their own: outside an assessed session, the sidebar offered records
but no agent, no view of what the AI is allowed to do for them, and no place
where their learning history accumulated into something useful.

Two structural problems sat on the instructor side of the same boundary:

1. Course setup listed structure counts (students, modules, pages, assessments)
   that restate the sidebar, and hosted the material library, while the things a
   professor actually configures for a course (grade scale, class policies, the
   course agent) lived elsewhere or nowhere.
2. Teacher Settings showed the course agent configuration, conflating two
   different agents: Atlas, the professor's own operator, and the course agent,
   the professor-governed persona that faces students. Those are different
   authorities with different owners and must not share a panel.

## Decision

### One product, four profiles, one policy ladder

The profile registry (`lib/agent/profiles.ts`) now has three live profiles:

- `professor` (surface `command`, anchored to a course): the professor's Atlas.
- `session` (surface `cue`, anchored to an assignment): the assessed session.
- `student` (surface `personal`, anchored to the organization): the student's
  own Atlas. It replaces the reserved `study` profile. It is organization wide
  because a student's academic life is not one course: it reads the student's
  own enrollments, standing, due work, grades, and the published material of
  enrolled courses, and nothing else.

Student-facing behavior is governed by a ladder, strictest first:

1. Fixed platform rules, in code (`lib/agent/student-atlas.ts`): never produce
   work for submission, no role confusion, grounded in the record, not a
   substitute for advisors or counselors, self-scope only.
2. University policy, a new append-only versioned record
   (`org_agent_policies`), owned by the institution (student success or
   academic affairs). Typed fields follow what universities actually publish:
   permitted learning uses, prohibited uses, disclosure expectation, a data
   notice, a not-a-substitute line, escalation contacts, and a daily turn
   limit. The highest version is active; a code default applies when an
   organization has not written one.
3. Course rules, the existing `course_agent_configs` object. Rules already
   carry `appliesTo: ["study", "assignment"]`; the personal agent applies each
   course's study-scoped rules when the conversation works on that course's
   material. Course rules ride in the reference pack as validated policy data;
   the fixed rules state that the strictest applicable layer wins.

Enforcement stays architectural, not rhetorical: route guards check role,
enrollment, organization, and the university policy switch; the turn limits are
counted server side; every tool executor repeats organization and enrollment
predicates; the model never sees a write path beyond its typed tools.

### Memory is a small curated store, not a transcript

`agent_memories` holds durable observations, per person, per authoring profile
(`student` or `professor`). Mechanics are borrowed from the open Hermes Agent
design and adapted to rows:

- One `remember` tool with `add`, `replace`, and `remove` actions. Nothing else
  writes memories.
- Hard budgets in code: entries are capped in length, the active set is capped
  in total characters, and an over-budget `add` returns a structured error that
  tells the agent to consolidate first. Memory stays curated, never a log.
- Every entry is scanned for instruction-control language before acceptance,
  because memories are injected into future prompts. Exact duplicates no-op.
- Replaced and removed entries archive with provenance (`replacesId`,
  `sourceSessionId`) instead of disappearing.
- Memories are injected as reference data with stable handles, below all
  policy layers, never as instructions.

The student profile page composes from the record first (standing, topic
scores, finalized session reports) and shows agent observations beside it.
No memory management UI ships: the agent curates, the surface reports.

### Session address change

`agent_sessions.course_id` becomes nullable and the `agent_surface` enum gains
`personal` (with `org` on the anchor enum), because a personal chat belongs
to a person in an organization, not to a course. Migration 0008 carries the
enum additions, the nullability change, the two new tables, and two new course
columns.

Atlas calls these records chats in the product and in model-visible tools.
Existing `thread` query parameters and internal type names remain compatibility
details, not product language. A personal Atlas chat can be archived but never
deleted: `agent_sessions.archived_at` removes it from active chat lists and
workflow resumption, while Settings exposes a direct restore control. Assessed
assignment sessions remain academic records and are outside this archive path.
Each stored turn's creation time hydrates message metadata; the interface keeps
that date out of the chat rail and reveals it below the message on hover or
keyboard focus.

### The instructor split: Settings is Atlas, Course setup is the course

- `/teach/settings` now describes the professor's own Atlas: who it works for,
  what it can do, what it remembers (the same memory store, authored by the
  professor profile), and the fixed system boundaries of every profile. The
  professor runtime gains the same `remember` tool.
- `/teach/course` (Course setup) becomes the course control center: identity
  and offering facts, the grade scale, class policies, the syllabus pointer,
  and the course agent (identity, teaching behavior, rules, disclosure,
  version history), read-first and changed in conversation with Atlas. The
  structure-count strip is gone; those destinations already live in the
  sidebar.
- The material library moves to its own page, `/teach/materials`, in the
  Course group. Materials are course content operations, not course setup.
- `courses.grade_scale` and `courses.class_policies` are typed, validated
  fields edited in Course setup and rendered live on the syllabus, so the
  syllabus cannot drift from the course. `gradeLetterFor` accepts a course
  scale and keeps its default; the syllabus consistency test still holds.

### Student navigation

The student sidebar gains an Atlas group after Courses: Atlas (the chat),
Profile (what Atlas knows, composed from record facts plus observations), and
Policies (university policy, each course's rules, and the fixed platform
rules, stated plainly).

### Personal documents stay personal

The student's Atlas accepts documents through the same durable-original and
bounded understanding seam as course documents, without assigning them to a
course. The `files`, processing, and attachment rows carry the owning student
instead. An attachment must point to that student's established personal
session in the same organization. Other students, instructors, and course
read paths cannot open the original, the readable artifact, or the model
context. The newest five ready documents are bounded to 80,000 characters in
the lower-authority reference message.

## Consequences

- The student runtime rides the existing durable seam unchanged: persist the
  user turn, claim the run, stream through the workflow, persist the response,
  compact. One new workflow function, no new runtime machinery.
- The reserved `study` profile is gone. Course-scoped study chat did not
  survive contact with the actual need: students need one agent that knows
  their whole record, with course rules applied contextually.
- `AgentSession.courseId` is nullable in types; course-scoped code paths that
  already filter by course are unaffected, and the personal store filters on
  `surface = personal` with `course_id IS NULL`.
- An organization admin surface for editing the university policy is deferred;
  the record is versioned and seeded, and the write path exists in code.
- Cross-profile handoffs (the student agent asking the professor agent a
  question) stay deferred as in ADR-0011.
