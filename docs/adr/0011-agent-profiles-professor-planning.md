# ADR-0011: Agent profiles and the professor planning runtime

Date: 2026-07-10
Status: accepted
Relates to: issue #27, ADR-0009 (AI SDK 7), ADR-0010 (turn-persisted streams)

## Context

Atlas now runs two conversational surfaces on the same substrate: the student
work session (Phases 2-3) and, with this decision, the professor planning
chat. The direction (issue #27, expanded) is a full agent harness: an agent
that works for the professor across the whole app, the assignment agent that
runs assessed sessions, a student study helper, and eventually agents that
hand work to each other. That future demands boundaries that hold by
construction, or a student will one day read another student's grades out of
a prompt.

Hermes Agent's profile model is the reference: a profile there is a separate
home directory, and every state read resolves through the profile's root, so
isolation is a property of state resolution, not of instructions. Atlas is a
multi-tenant Postgres app, not a filesystem, so the borrow is the principle:
a profile is a scope boundary enforced where state is resolved.

## Decision

### 1. Profiles are a registry of scope boundaries (lib/agent/profiles.ts)

Three profiles: `professor` (live), `session` (live), `study` (planned).
Each claims a unique session address inside `agent_sessions`, stated as
(surface, anchorType):

- professor: `command` / `course`, one thread list per (instructor, course);
- session: `cue` / `assignment`, one open run per (student, assignment);
- study: `cue` / `course`, reserved for the harness follow-up.

The registry is load-bearing, not documentation: the stores read these
addresses from it (`session-store.ts`, `session.ts`), so a new profile
starts by claiming an address, and two profiles can never share one. Each
profile also carries a capability description (the future cross-profile
routing contract) and a stated boundary (reads / writes / never) that tests
pin.

Boundary enforcement stays where it has always been in Atlas:

- context loaders take the scope as ARGUMENTS (`buildProfessorPack` takes
  the authenticated instructor and the course in view; the session pack
  takes one studentId), so there is no parameter through which a runtime
  could reach across a boundary;
- routes check the principal and fail closed before generation;
- write-shaped tools produce `changeProposals` rows behind Review; no
  profile mutates live course records from a conversation.

### 2. The professor runtime reuses the turn-persisted seam (no WorkflowAgent)

`runProfessorTurn` mirrors `runSessionTurn` on the ADR-0010 seam: persist
the user turn before generation, rebuild the pack per turn, stream with a
closed tool set, persist the assistant turn (text and tool parts) on end,
compact when the verbatim tail outgrows the budget. Planning threads are the
command-surface sessions the cockpit already lists as planning history; the
seeded Exam 2 planning session is simply the first row of the surface.
Issue #27's architecture door is honored: no `WorkflowAgent`, no new
runtime, org BYOK via `resolveModelForOrg` unchanged.

### 3. Three tools, one door

The professor profile's tool set is closed: `read_page` (full page bodies;
the pack clips them), `propose_rubric`, and `propose_records` (modules,
work, pages, announcements, practice sets, objectives). Both proposal tools
insert `changeProposals` + `proposalBlocks` rows with the planning session
as provenance and return structured errors instead of throwing. Applying is
Review's job, unchanged.

Course AI policy edits are deliberately NOT a tool in this slice: policy
stays a direct settings surface (`/teach/settings`, the per-assignment
contract form). A policy block through the gate is harness follow-up work.

### 4. Rubric drafts are a first-class block (session_rubric)

`session_rubric` enters the block registry carrying the SAME criteria shape
the `rubrics` table stores and the grading pipeline reads, plus the target
assignment. `normalizeRubricDraft` enforces the grading invariants before a
row exists: integer weights summing to 100, all four levels, Exceeds equal
to the weight, Missing worth 0, points strictly descending; missing points
derive from the demo world's own ladder (100 / 80 / 50 / 0 percent of
weight). The payload must round-trip `parseStoredBlock` before insertion,
so an approved draft can never fail to apply.

Applying writes a NEW rubric version (max version + 1 for the course) and
repoints the session assignment. Versioning on this path is always-new:
grades stay pinned to the version that graded them, and the direct weights
editor keeps its own in-place-before-grading behavior.

### 5. Presentation: the draft renders as the record it will become

The planning room renders a rubric draft with `RubricCard`, the same
component Review uses: criteria, weights, the four-level ladder with
points, and a comparison against the version it replaces (weight deltas,
revised descriptors with the previous text one disclosure away, criteria
added and not carried over). The comparison baseline is captured at draft
time inside the tool output, so a reopened thread shows the change the
professor actually approved, not a diff against whatever is live today.

## Presentation revision (2026-07-10, founder review)

The first cut put the conversation behind a button on a records page, and
the shell still carried a hard-coded immersive mode for `/teach/atlas` (a
command-console relic) that locked the sidebar collapsed with no expand
affordance and stripped the content padding. Both are gone, and the
hierarchy now says what the product means:

- **The agent is the surface.** `/teach/atlas` IS the conversation; threads
  switch in place (`?thread=`). There is no separate planning route and no
  records showcase in front of the chat.
- **One shell everywhere.** The sidebar's state belongs to the user, never
  to a route. The immersive branch is deleted and the contract test keeps
  it out.
- **AI assignments are ordinary course records.** The type is named plainly
  ("AI assignment", not "work session"), it appears as a fact on the Work
  list row, and its grading surface (journeys, rubric, class insight) is
  entered from the assignment under Work, like any grading surface. The
  agent page carries them only as rail context for the conversation.
- **No navigation section per agent.** The sidebar mirrors the course, not
  the machinery: the professor has one agent entry (Atlas), the assignment
  agent lives inside each assignment, and the study agent will live on the
  student side. An agent earns a nav item only when it grows a real,
  distinct surface.
- **The record type gets its own lens, the agent does not carry it.** A
  second founder round added the AI assignments tab to the Atlas group
  (Atlas, AI assignments, Review, Settings), so the group reads as the AI
  lane of the course: talk to the agent, manage the governed work, decide
  drafts, hold the keys. The tab is SEE, INSPECT, GOVERN only: every AI
  assignment with its facts and class status, and the course AI policy
  stated plainly (edited in Settings). It carries no forms and no creation
  module; the contract test pins that. The grade view and drill-in moved
  under `/teach/ai-assignments/*` so the URL says what the page is;
  `/teach/atlas` is only ever the conversation, and the chat rail carries
  no record lists. One canonical grade view, two doors: the Work record
  and the tab.
- **Creation is a conversation, and only a conversation.** A third founder
  round removed the tab's direct-creation form as off-thesis: you chat with
  Atlas when you need an AI assignment. To make that true rather than
  claimed, the professor profile gained `propose_ai_assignment`: the whole
  AI assignment (brief, duration, transcript policy, side-notes toggle, and
  the rubric, shaped in conversation or started from the standard
  four-criterion frame) as ONE `ai_assignment` block behind Review.
  Applying writes the next rubric version and the session-assignment row in
  one transaction; dup guards refuse a second config or a second pending
  draft for the same assignment. The card in the thread and in Review
  renders the contract facts and the full rubric, the record it will
  become.

## Consequences

- No schema changes. Profiles map onto existing enums; rubric proposals ride
  existing tables. The PR is migration-free.
- The cockpit read layer gains `loadPlanningRoom` and keeps its no-writes
  contract; all planning mutations live in the tools behind Review.
- The study profile is a declared boundary with no runtime; the harness
  follow-up issue owns it, cross-profile messaging, recall scoping, and
  policy blocks.
- Compaction for planning threads uses the generic session summarizer; if
  drafting-heavy threads lose too much context, a profile-aware compaction
  prompt is a contained follow-up on this seam.
