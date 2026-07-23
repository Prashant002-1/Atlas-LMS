# v0 Implementation Plan

**Status:** Phases 0-4 are complete and merged. Phase 5 is demo readiness: live validation, on-camera polish, and recording. The professor-facing agent-chat layer is deliberately deferred to a separately planned architecture phase.

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

**Status:** Complete. The remaining live-persistence and surface work landed in Phases 2-4.

**Intent:** establish the data and type substrate the session engine will use.

Completed:

- Kept and cleaned the reusable substrate: `agentSessions`, `agentTurns`, `changeProposals`, `proposalBlocks`, `courseAiPolicies`, the platform provider registry, context-pack discipline, and the apply gate.
- Added the v0 fixture contract and typed payloads for scenario slots, session assignment, rubric, student sessions, artifact states, side-note cards, evidence spans, journey reports, class rollup, and validation.
- Replaced the old multi-course catalog with a single active ECON-241 demo world: one professor, 31 students, current mid-semester workload, active latest note, full session transcripts, journey reports, and deterministic rollups.
- Seed now loads the active demo package plus current-schema agent sessions, turns, proposals, and proposal blocks.
- Fixture tests assert the active-course shape, evidence verification, student-scoped evidence, rollup recomputation, and the professor-dashboard-driving workload counts.

Delivered in later phases:

- The runtime route turns the v0 fixture shape into durable live student sessions.
- Artifact state, side-note cards, journey reports, and evidence spans persist in native rows through the live write pipeline.
- The student-facing session surface and professor drill-in close the student-to-professor loop.

Definition of done:

- `npm run verify` passes.
- `npm run db:seed` produces one active ECON-241 course with realistic mid-semester activity.
- The fixture contract is strong enough for Phase 2 to build against without reintroducing the old catalog or old command/cue runtime.

## Phase 2 - Session engine

**Status:** Complete, merged (PR #23).

**Intent:** a student can actually take a session assignment.

Built:

- Durable streaming path decided and recorded (ADR-0010): plain AI SDK 7 `streamText` inside a UI message stream, with every turn persisted to `agent_turns` around the stream. The user turn lands before generation; the assistant turn (text + exact artifact tool parts + `data-side-note` parts) lands on stream end. Refresh rehydrates from rows. `WorkflowAgent` deferred: its self-hosted Postgres World needs a long-lived polling worker and a standalone build target, with an unresolved self-hosting bug, wrong tradeoff for a self-hosted demo build. The seam is `lib/agent/session-runtime.ts`.
- Native rows where the live pipeline needs queryable persistence (the decision at that door): `rubrics` (versioned criteria), `session_assignments` (the per-ASSIGNMENT policy object: duration, grounding scope, personal-record side-note toggle, sanctioned side-note triggers, planning-session provenance), `session_artifact_states`, `session_side_notes`, `session_submissions`, plus `submissions.topic_scores` (self-describing per-topic exam breakdown). Migration `drizzle/0001_v0_session_engine.sql`; `db:push` derives the same state. Every assessed submission stores its transcript for instructor review.
- Session context pack (`lib/agent/session-context.ts`): the base student pack plus session contract, full rubric, the student's own record, and professor planning provenance. Instructions state the doctrine: never produce the deliverable, Socratic, stress-test, ground and cite, capture every substantive revision through the exact artifact tool for that deliverable.
- Side-note cards (`lib/agent/side-notes.ts`): server-triggered and deterministic. A card fires only when the professor toggle is on AND a sanctioned trigger keyword lands in the student's turn AND the student's own exam record is weak on that topic AND the topic has not fired yet. Text is composed from record numbers (points lost, exam name, planning-session title), never generated. Persisted, then streamed as a `data-side-note` part.
- Student session surface (`/student/session/[assignmentId]`): brief, rubric panel ("what doing well looks like"), duration timer, conversation with in-flow flagged side-note cards, evolving artifact panel with revision tabs and change highlights, and Submit. The work page routes session assignments into it and keeps the classic response form for everything else.
- Submit (`submitSession` action + `submitSessionRecord`): one transaction freezes the normalized transcript (stable turn ids, speaker roles, plain text per turn, artifact states, final artifact) into `session_submissions` and mirrors the state onto the classic gradebook row. `verifyQuote` ships with the transcript shape so Phase 3 inherits the string-match contract.
- Seed now lands the whole demo world in the new rows too: rubric, session assignment, artifact states, the canonical side note, and 28 frozen session submissions normalized through the SAME code path the live submit uses. Tests re-verify seeded evidence quotes through that path.

Definition of done:

- The featured student can complete a full session against seeded content.
- A refresh during the session does not lose the transcript.
- Submit persists a normalized transcript with artifact states.
- The resulting data is ready for the grading pipeline.

## Phase 3 - Grading pipeline

**Status:** Complete, merged (PR #24).

**Intent:** the rubric reads the transcript.

Built:

- Native rows: `evidence_spans` (verbatim quotes located by turn + char offsets, string-verified before storage), `journey_reports` (per-criterion `{level, score, rationale, evidenceSpans[]}`, draft until the professor finalizes, grader provenance recorded), `class_rollups` (one per course + assignment). Migration `drizzle/0002_v0_grading_pipeline.sql`; `db:push` equivalent.
- The pipeline (`lib/agent/grading.ts`), per criterion: extract candidate quotes from STUDENT turns only -> verify every quote by exact string match against the frozen transcript, with one feedback re-extraction on total failure, then drop -> judge the level from the criterion's own descriptors plus verified evidence with surrounding context and the frozen artifact -> score is the rubric level's points, a deterministic mapping; the model never picks a number. No verifiable evidence stores a Missing-level draft for professor review; a model failure aborts the run and stores nothing (a grading outage never grades a student down).
- Decisions at this door, resolved: single-model grading shipped; the council (3 models + chair synthesis) stays deferred behind the `judgeCriterion` seam until final-grade stakes warrant it. Grading runs synchronously on submit through Atlas's platform model; `npm run regrade` covers pending/forced regrades and the calibration pilot.
- Class rollups (`lib/agent/rollup.ts`): deterministic aggregation over stored reports and side notes (criterion level counts, average/median, side-note topic fire counts, review requests), computed by code and never asserted; the narrative is a template sentence built from those numbers, with an optional model paraphrase that may only repeat them and falls back to the template.
- Student payoff: the session page renders the journey report (four criteria, levels, rubric points, rationale, verified evidence quotes with the surrounding exchange one click away) plus a "Request professor review" chip that stamps the report for the Phase 4 queue. Draft reports say so: the professor confirms before it counts.
- Seed lands the graded world: 112 evidence spans and 28 journey reports (20 final where the gradebook shows a grade, 8 draft) for the frozen sessions, and a class rollup computed through the same aggregation code the live pipeline uses. Seeded gradebook scores now EQUAL their journey report sums (Strong 100, Steady 80, Recoverer 86, Struggling 49, Delegator 34), with a fixture check pinning the invariant; delegation earning almost nothing is the story, not a bug.
- Tests: the full pipeline runs against the real seeded featured-student transcript with a scripted model (verification failure -> re-extraction exercised, canonical 86 reproduced, every stored span re-verified by string match); pure tests pin verification refusals (tutor turns, fabricated quotes), whitespace recovery storing only transcript characters, deterministic level-to-score mapping, rollup aggregation and narrative discipline.

Definition of done:

- Submitting a session produces a stored, evidence-verified journey report.
- The seeded archetypes grade plausibly and reproducibly.

Follow-up validation, owned by Phase 5:

- One live calibration run with platform model credentials: `npm run regrade -- --all` over the 28 seeded transcripts, then eyeball archetype plausibility (the calibration pilot against professor blind grades comes before anyone calls it a grade).

## Phase 4 - Professor surfaces

**Status:** Complete, merged (PR #25).

**Intent:** close the loop on the professor side.

Built:

- The session cockpit replaces the Phase 0 shell at `/teach/atlas`: every work session in the course with its class at a glance, plus the professor's planning history (the provenance the student side-notes trace back to, expandable to the full planning transcript).
- Per-assignment cockpit (`/teach/ai-assignments/[assignmentId]`): the session contract and rubric are read-first, with changes routed through the assignment's persisted Atlas planning thread. The session table and class insight keep submitted work and evidence in view. Rubric versioning remains honest: existing graded reports stay pinned to the version that read them.
- Journey grid: one card per enrolled student from four set-based queries joined in memory (no N+1), latest submission per student, ordered by what needs the professor first. The state machine (not_started / in_session / pending_grading / draft / review_requested / final) is one pure function pinned by an exhaustive test.
- Journey drill-in (`/teach/atlas/journey/[submissionId]`): the report with the rubric's own points, every evidence quote a jump-link to its exact place in the FROZEN transcript, where verified spans render highlighted in the characters they were taken from, side notes and artifact revisions alongside. Ungraded submissions offer "Run the rubric" in place.
- Finalize is the publish moment and the ONLY session-grade gradebook writer: one transaction flips draft -> final with a who/when audit (finalizedAt, finalizedById; migration `drizzle/0003`), marks the frozen submission graded, and writes the classic gradebook row. Regrade reruns drafts only; a published grade stays the record (reopen is a later explicit affordance).
- Class insight renders the STORED rollup (never recomputed at render; an explicit Refresh action recomputes, and a staleness chip shows when stored stats disagree with live counts). "Propose practice set" closes the loop through the EXISTING changeProposals approve gate: deterministic transform of the stored recommendation (objective alignment derived by matching concepts against the course record), model draft grounded on the stats as fallback, and the payload must round-trip the apply gate's own block schema before insertion, so an approved draft can never fail to apply. Review's proposal card now previews practice-set questions.
- The classic assignment page banners into the cockpit for session assignments; smoke checks the cockpit; the route contract gains a phase 4 block including two architectural pins (the cockpit read layer contains no writes and never recomputes rollups inline).

Deliberately deferred, recorded here: creating a NEW session assignment from scratch (the seeded one is configured; creation arrives with planning-session tooling), per-criterion grade overrides before finalize (accept or regrade for v0), reopening a finalized report, and the feedback-dictation flash (cut line 1).

Definition of done:

- The demo loop is clickable end to end: configure -> student session -> journey report -> class insight -> approve.

Follow-up validation, owned by Phase 5:

- A live end-to-end walk with platform model credentials and seeded db: edit a weight, watch v2 appear; open a draft journey, spot-check highlighted evidence, finalize; refresh insight; propose the practice set and apply it in Review.

## Phase 5 - Polish and recording

**Status:** Next: demo readiness.

**Intent:** make the loop filmable.

Build:

- Use the active demo world as the source of truth unless the scenario changes.
- Keep only on-camera polish in scope.
- Run the live grading calibration over the 28 seeded transcripts before presenting output as a grade.
- Walk the full seeded loop with platform model credentials: revise a rubric, inspect and finalize a draft journey, refresh class insight, then propose and apply the practice set.
- Record against the real seeded data and the same live product path used for interviews.

Definition of done:

- The demo video and live product run the same loop.

## Deferred architecture: professor agent chat

The completed cockpit is intentionally a configure, review, and approval surface. It does not include a professor-facing agent chat, and the broader AI SDK integration belongs in that future layer rather than being implied by the student-session runtime.

This is not Phase 5 work. Its architecture, application boundaries, context, actions, persistence, and review model remain unplanned until the next phase is explicitly designed.

## Decisions at the door

| Decision | Needed by | Default if undecided |
|---|---|---|
| Durable session path | Phase 2 | Selected plain AI SDK 7 turn-persisted streams; `WorkflowAgent` deferred in ADR-0010 |
| Assignment-type name | Phase 2 | Work session |
| Native tables vs typed fixture payloads for v0-only objects | Phases 2-3 | Native rows for every live, queryable pipeline object |
| Council grading | Phase 3 | Single-model grading shipped; council remains behind the judge seam |
| Final scenario change | Phase 5 | Keep ECON-241 / VidStack unless explicitly changed |

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
