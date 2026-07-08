# v0 Implementation Plan

**Status:** Phase 0 is complete. Phase 1 is complete (the v0 payloads now seed as native rows). Phase 2 is built and in review.

**Runtime decision:** AI SDK 7 is the runtime foundation. Eve is removed, not completed. `WorkflowAgent` was evaluated at the Phase 2 door and deferred with reasons; the session engine runs plain AI SDK 7 streams with Postgres turn persistence behind one seam module. See ADR-0010.

## How this plan works

- **Phases, not tickets.** Each phase has an intent, deliverables, and a definition of done.
- **Camera-first.** The demo script is the acceptance test. If it is not on camera and not required to make on-camera things real, it is out of scope by default.
- **Vertical slices.** Every phase ends with something runnable or inspectable. No phase ends in "wiring done, nothing visible."
- **Decisions at the door.** Open choices are pinned to the phase that needs them, not decided speculatively.
- **Cut lines are pre-agreed.** Pressure produces scope cuts, not quality cuts.

## Phase 0 - Clear the ground

**Status:** Complete.

**Intent:** create a clean, green foundation so every later phase builds on stable ground.

Completed:

- Removed Eve end to end from active code: dependency, mounted runtime, Eve command route, bridge auth, runtime env split, Eve session cursor columns, and public `/eve` routing.
- Removed the obsolete command/cue product path: command console, cue panel and route, block views, old runtime files, and old broad catalog seed.
- Upgraded the runtime dependency shape to stable AI SDK 7 and kept the repo green.
- Added ADR-0009 to record the v0 runtime decision and supersede ADR-0008.
- Added the migration and route-contract tests that prevent the old runtime from coming back silently.

Definition of done:

- `npm run verify` passes.
- No active Eve references remain outside historical docs/ADR text and tests that assert removal.
- The app boots through the standard authenticated route surface.
- `/teach/atlas` is an intentional v0 shell, not the old command console.

## Phase 1 - Primitives and demo world

**Status:** Mostly complete. Complete enough to move to Phase 2, with the remaining primitive work tied to the live session engine.

**Intent:** establish the data and type substrate the session engine will use.

Completed:

- Kept and cleaned the reusable substrate: `agentSessions`, `agentTurns`, `changeProposals`, `proposalBlocks`, `courseAiPolicies`, BYOK, context-pack discipline, and the apply gate.
- Added the v0 fixture contract and typed payloads for scenario slots, session assignment, rubric, student sessions, artifact states, side-note cards, evidence spans, journey reports, class rollup, and validation.
- Replaced the old multi-course catalog with a single active ECON-241 demo world: one professor, 31 students, current mid-semester workload, active latest note, full session transcripts, journey reports, and deterministic rollups.
- Seed now loads the active demo package plus current-schema agent sessions, turns, proposals, and proposal blocks.
- Fixture tests assert the active-course shape, evidence verification, student-scoped evidence, rollup recomputation, and the professor-dashboard-driving workload counts.

Still primitive-adjacent, but belongs with Phase 2 implementation:

- The runtime route has not yet turned the v0 fixture shape into a live student session.
- Artifact state, side-note cards, journey reports, and evidence spans currently exist as typed fixture payloads, not as a completed live write pipeline.
- The student-facing session surface and professor drill-in are not built yet.

Definition of done for the current Phase 1 state:

- `npm run verify` passes.
- `npm run db:seed` produces one active ECON-241 course with realistic mid-semester activity.
- The fixture contract is strong enough for Phase 2 to build against without reintroducing the old catalog or old command/cue runtime.

## Phase 2 - Session engine

**Status:** Built, in review (feat/session-engine).

**Intent:** a student can actually take a session assignment.

Built:

- Durable streaming path decided and recorded (ADR-0010): plain AI SDK 7 `streamText` inside a UI message stream, with every turn persisted to `agent_turns` around the stream. The user turn lands before generation; the assistant turn (text + `update_artifact` tool parts + `data-side-note` parts) lands on stream end. Refresh rehydrates from rows. `WorkflowAgent` deferred: its self-hosted Postgres World needs a long-lived polling worker and a standalone build target, with an unresolved self-hosting bug, wrong tradeoff for a self-hosted demo build. The seam is `lib/agent/session-runtime.ts`.
- Native rows where the live pipeline needs queryable persistence (the decision at that door): `rubrics` (versioned criteria), `session_assignments` (the per-ASSIGNMENT policy object: duration, grounding scope, transcript policy, personal-record side-note toggle, sanctioned side-note triggers, planning-session provenance), `session_artifact_states`, `session_side_notes`, `session_submissions`, plus `submissions.topic_scores` (self-describing per-topic exam breakdown). Migration `drizzle/0001_v0_session_engine.sql`; `db:push` derives the same state.
- Session context pack (`lib/agent/session-context.ts`): the base student pack plus session contract, full rubric, the student's own record, and professor planning provenance. Instructions state the doctrine: never produce the deliverable, Socratic, stress-test, ground and cite, capture every design revision via `update_artifact`.
- Side-note cards (`lib/agent/side-notes.ts`): server-triggered and deterministic. A card fires only when the professor toggle is on AND a sanctioned trigger keyword lands in the student's turn AND the student's own exam record is weak on that topic AND the topic has not fired yet. Text is composed from record numbers (points lost, exam name, planning-session title), never generated. Persisted, then streamed as a `data-side-note` part.
- Student session surface (`/student/session/[assignmentId]`): brief, rubric panel ("what doing well looks like"), duration timer, conversation with in-flow flagged side-note cards, evolving artifact panel with revision tabs and change highlights, and Submit. The work page routes session assignments into it and keeps the classic response form for everything else.
- Submit (`submitSession` action + `submitSessionRecord`): one transaction freezes the normalized transcript (stable turn ids, speaker roles, plain text per turn, artifact states, final artifact) into `session_submissions` and mirrors the state onto the classic gradebook row. `verifyQuote` ships with the transcript shape so Phase 3 inherits the string-match contract.
- Seed now lands the whole demo world in the new rows too: rubric, session assignment, artifact states, the canonical side note, and 28 frozen session submissions normalized through the SAME code path the live submit uses. Tests re-verify seeded evidence quotes through that path.

Definition of done:

- The featured student can complete a full session against seeded content.
- A refresh during the session does not lose the transcript.
- Submit persists a normalized transcript with artifact states.
- The resulting data is ready for the grading pipeline.

Remaining to call the phase closed after review:

- `npm run verify` green locally (sandbox could not run installs; code is written against the verified v7 API surface).
- One live end-to-end run with a real model key: featured-student session, side note firing on the slope confusion, artifact revisions, submit.

## Phase 3 - Grading pipeline

**Status:** Later.

**Intent:** the rubric reads the transcript.

Build:

- Normalize transcript turns and artifact states.
- Extract per-criterion evidence from student turns.
- Verify every quote by string match before it can affect a score or appear in UI.
- Assign rubric levels from verified evidence and rubric descriptors.
- Aggregate journey reports and deterministic class rollups.

Definition of done:

- Submitting a session produces a stored, evidence-verified journey report.
- The seeded archetypes grade plausibly and reproducibly.

## Phase 4 - Professor surfaces

**Status:** Later.

**Intent:** close the loop on the professor side.

Build:

- Assignment setup for the session contract and rubric.
- Journey card grid, drill-in, transcript view, and evidence-backed rubric display.
- Class insight from stored rollups.
- Practice-set proposal behind the existing approve gate.

Definition of done:

- The demo loop is clickable end to end: configure -> student session -> journey report -> class insight -> approve.

## Phase 5 - Polish and recording

**Status:** Later.

**Intent:** make the loop filmable.

Build:

- Use the active demo world as the source of truth unless the scenario changes.
- Keep only on-camera polish in scope.
- Record against the real seeded data and the same live product path used for interviews.

Definition of done:

- The demo video and live product run the same loop.

## Decisions at the door

| Decision | Needed by | Default if undecided |
|---|---|---|
| Durable session path | Start of Phase 2 | Try `WorkflowAgent`; fall back only if it slows the build down |
| Assignment-type name | First Phase 2 UI copy | Session |
| Native tables vs typed fixture payloads for v0-only objects | When Phase 2 starts writing live outputs | Add native rows only where the live pipeline needs queryable persistence |
| Council grading | Phase 3 | Single-model grading first; council remains behind a flag |
| Final scenario change | Before recording polish | Keep ECON-241 / VidStack unless explicitly changed |

## Cut lines

Drop in this order if scope grows:

1. Feedback dictation flash
2. Council grading
3. Appeal flow beyond a chip and transcript link
4. Grid sorting/filtering niceties
5. Extra montage screens

Never cut: side-note cards, artifact panel state, quote verification, and approval gates.

## Working agreements

- Main stays green.
- Update the doc that owns a decision in the same commit as the decision.
- No off-camera features and no speculative generality.
