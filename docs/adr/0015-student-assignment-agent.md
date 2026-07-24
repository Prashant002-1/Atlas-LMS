# ADR-0015: Student Assignment Agent and Workspace

**Status:** Accepted  
**Date:** 2026-07-20

## Context

Atlas had made the professor agent a course-wide LMS operator and had made the course agent configurable as versioned policy. The student assignment session still looked and behaved like a Phase 2 demo surface:

- the client presented a generic bordered chat beside stacked cards;
- the artifact tool accepted only a pricing table tied to one economics scenario;
- assignment identity and course identity repeated across the page and sidebar;
- student course pages used more panels and explanatory copy than their information required;
- ordinary assignment routes and teacher navigation still used the product label `Work`.

The student agent must be a real manifestation of the professor without turning prompt text into authorization. The assignment must still feel like an assessed session, not like an open-ended chatbot.

## Decision

### 1. The existing course-agent boundary remains load-bearing

Every accepted student turn continues to resolve the active version of `course_agent_configs` inside the authenticated organization and course. The route verifies the student role, active enrollment, assignment contract, submission state, turn budget, and Atlas platform model before generation.

`compileCourseAgentConfiguration` supplies the professor-defined identity, voice, teaching approach, answer policy, challenge level, citations, boundaries, limits, and enabled rules. Fixed assessed-session rules and the assignment contract remain higher authority. Configuration cannot add tools, widen scope, reveal other students, or weaken the rule that the student produces the submission.

The runtime may compose the server-owned `search_web` read alongside the exact artifact tools. Platform, university, and course external-source policy are intersected before tool assembly. The assessed-session contract still wins, and an external source can never complete the student's work.

### 2. Artifact state becomes assignment-general through one registry seam

`lib/agent/session-parts.ts` remains the single schema seam for tool input, stream parsing, persistence, and rendering.

Atlas normalizes artifact state into an internal discriminated union:

- `structured_response` represents ordinary assignment drafts as titled sections with content, labeled fields, or lists;
- `pricing_table` remains supported for existing seeded transcripts.

The model-facing surface exposes one exact object tool, `update_artifact`, whose sections adapt to the assignment's actual deliverable. This avoids provider-incompatible union schemas and demo-shaped assignment branching. Stream parsing still accepts historical `update_pricing_table`, `update_structured_response`, and wrapped `update_artifact` parts. Existing raw pricing artifacts remain readable. New structured artifacts flow through the same persistence and grading path.

### 3. The student session uses the same conversation substrate as the professor agent

The student session is a full-height AI Elements workspace inside the normal application shell. It has:

- one compact assignment header;
- the conversation as the primary surface;
- a floating composer with a real stop action;
- a responsive assignment-details rail for the contract, submission draft, rubric, grade, timer, and submit action;
- server-composed course notes rendered in the conversation as distinct annotations, not assistant bubbles.

The agent initiates pedagogical moves from the professor configuration, assignment contract, rubric, and course context. The client does not fake stages or inject scenario-specific coaching prompts.

### 4. Record language and navigation use the direct noun

`Assignments` replaces the product label `Work`. Canonical routes are `/teach/assignments` and `/student/assignments/[assignmentId]`. The former work routes remain framework redirects for compatibility.

Student course rows carry no book icon. Syllabus uses a document symbol. Geist Sans carries navigation and prose labels; Geist Mono is reserved for codes, figures, and timestamps.

### 5. Overviews become selective

The student course home shows the course once, then the current module, open assignments, and announcements. It omits the course description because the syllabus owns that content.

The teacher overview removes Recent changes and per-assignment points, submitted, and graded strings. It shows a short assignment list with due dates, upcoming dates, announcements, and a deterministic Atlas briefing composed from ungraded, missing, and Review counts.

## Consequences

- No schema migration or new dependency is required.
- Existing pricing-session fixtures and transcripts remain valid.
- New AI assignments are no longer forced into economics-specific artifact fields.
- Both professor and student agents share the AI Elements interaction language while retaining different information architecture and authority.
- Old work URLs continue to resolve, but new links and actions use the assignment routes.
- The deterministic briefing avoids a model call on every overview render and cannot invent activity.
