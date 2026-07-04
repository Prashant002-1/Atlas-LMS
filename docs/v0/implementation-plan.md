# v0 Implementation Plan

**Date:** 2026-07-04. **Deadline:** YC application July 27, 8pm PT (23 days); product must be live-demoable for interviews in August. **Runtime decision (ratified):** AI SDK 7 + WorkflowAgent-or-equivalent durability + typed data parts + our own Postgres. Eve is removed, not completed.

## How this plan works

- **Phases, not tickets.** Each phase has an intent, deliverables, and a definition of done. The how inside a phase is decided when the phase starts, with what we know then.
- **Camera-first.** The 3-minute demo (docs/demo/script.md) is the acceptance test. If it is not on camera and not required to make on-camera things real, it is out of scope by default.
- **Vertical slices.** Every phase ends with something runnable. No phase ends in "wiring done, nothing visible."
- **Decisions at the door.** Open choices are pinned to the phase that needs them, not decided speculatively now.
- **Cut lines are pre-agreed** (bottom of this doc), so schedule pressure produces scope cuts, not quality cuts.

## Phase 0 - Clear the ground (~Jul 4-6)

**Intent:** a clean, green foundation so every later phase builds on stable ground.

- Remove Eve end to end: dependency, eve-command route, eve-auth.ts, ATLAS_COMMAND_RUNTIME split, eve columns on agentSessions (migration), /eve middleware allowlists.
- Upgrade to AI SDK 7 stable (off the ^7.0.0-beta pin); regenerate package-lock; get verify (typecheck, lint, tests, build) green and keep it green from here on.
- Delete discard-tier code deliberately (command console, cue panel + route, block-views, cueEvents, chatSessions/chatMemories/plannerState, old fixture content). Git history is the archive; no deprecation stubs.
- Write ADR-0009 (runtime: AI SDK 7, Eve removed and why) superseding ADR-0008. Settle the ADR numbering question (0001-0007 referenced but absent) with a one-line note in the ADR index.

**DoD:** repo builds and verifies clean with no Eve references; the app boots to sign-in and an intentionally empty shell; ADR-0009 merged.

## Phase 1 - The primitives (~Jul 6-9)

**Intent:** the five primitives exist as schema and types. Everything after this is UI and pipelines over these objects.

- Migrations: session_assignment (per-assignment config: instructions, duration, grounding scope, transcript policy, side-note toggle) - rubric (criteria, weights, level descriptors, version) - session adaptation (kind: professor_planning | student_session; link to assignment) - artifact state snapshots (versioned, diffable) - evidence (sessionId, turnId, charStart, charEnd) - journey_report (per-criterion level + evidence refs + rubric version). Adapt, do not rebuild, agentSessions/agentTurns, changeProposals/apply, courseAiPolicies-successor.
- New block registry: replace the 9 old block types with the v0 set (artifact panel state, side-note card, rubric draft, journey card, practice-set proposal). Same zod registry pattern (tool input + render + persisted row).
- **Mini-world seed:** 1 professor, 3 students, placeholder econ content, hand-authorable - enough for phases 2-3 to develop against. The full 31-student world comes from the data blueprint in phase 5.

**DoD:** migrations apply; seed loads the mini-world; types compile end to end; a trivial script can create a session assignment and open a session row.

## Phase 2 - The session engine (~Jul 9-14)

**Intent:** a student can actually take a session assignment. This is the heart; it gets the most days.

- Streaming session route on AI SDK 7: durable/resumable turn handling (spike day 1: WorkflowAgent vs plain streamText + resumable transport; if WorkflowAgent fights back for more than a day, fall to Trigger.dev per architecture.md - decision recorded, not revisited).
- Context packs adapted: course materials + syllabus/outcomes + student record (exam subscores) + professor planning-session history, budgeted and deterministic like the old context.ts.
- Typed data parts flowing: artifact panel updates and side-note cards as structured stream parts, never prose.
- Side-note trigger: policy-gated (toggle), fires from the joined context (student weakness x professor plan x current topic).
- Student surface: exam-room chrome (brief pinned, rubric chip, grounding chips, timer, Submit), split view with the evolving artifact panel, side-note margin. Meridian-styled but plain; polish is phase 5.

**DoD:** the featured mini-world student completes a full session against seeded content, survives a mid-session refresh, and Submit persists a normalized transcript with artifact states.

## Phase 3 - The grading pipeline (~Jul 14-17)

**Intent:** "the rubric reads the transcript" becomes real, per architecture.md section 2.

- Pipeline stages: normalize -> per-criterion span extraction (student turns only) -> quote verification by string match (unverified quotes never surface) -> per-criterion level assignment against descriptors -> journey report aggregation -> deterministic class rollup with LLM narration on top.
- Single strong model per criterion for v0; council + chair behind a flag, used only for final grades if time allows (cut line).
- Student journey report UI (levels, evidence quotes, appeal chip) - the professor drill-in reuses this rendering in phase 4.
- Calibration ritual: grade the 3 hand-crafted mini-world transcripts, compare against their intended outcomes from the blueprint archetypes; tune prompts until they land within one level.

**DoD:** submitting a session produces a stored, evidence-verified journey report; the mini-world's three archetype transcripts grade plausibly and reproducibly.

## Phase 4 - The professor surfaces (~Jul 17-21)

**Intent:** close the loop; the professor side of the camera.

- Assignment setup: agent drafts the rubric from syllabus + outcomes as a proposal block -> professor edits weights -> approve through the existing apply door; config toggles on the same screen.
- Review: journey cards grid (sortable), drill-in (journey report + transcript one click deep), class-insight turn ("what should Thursday cover?") answered from stored rollups, practice-set proposal gated by approve.
- Feedback dictation flash (professor rough notes -> drafted note quoting the student's session) - stretch, first on the cut list.

**DoD:** the full demo loop is clickable end to end on the mini-world: configure -> student session -> journey report -> grid -> insight -> approve.

## Phase 5 - Demo world, polish, recording (~Jul 21-25)

**Intent:** make it filmable and film it.

- Execute the data blueprint with the FINAL scenario via a data-generation agent; run the acceptance checklist; load the 31-student world.
- Rewrite docs/demo/script.md's draft script for the final scenario; freeze narration.
- Meridian polish pass on the five on-camera screens only; kill every empty/dead state the camera might touch.
- Record: screen capture at real speed, jump-cut edit, narrate; keep two spare days for retakes. Submit the application.

**DoD:** the 3-minute video exists and matches the script; the live product runs the same loop for August interviews.

## Decisions at the door

| Decision | Needed by | Default if undecided |
|---|---|---|
| Final scenario (course/problem) | Start of phase 5 (blueprint execution); earlier is better for phase 3 tuning | Econ placeholder ships in the mini-world regardless |
| Assignment-type name (Session vs Tutorial) | First UI copy in phase 2 | Build behind one constant; "Session" as default |
| WorkflowAgent vs fallback durability | Day 1 of phase 2 (timeboxed spike) | Trigger.dev per architecture.md |
| Council grading for finals | End of phase 3 | Single-model with the council behind a flag |

## Cut lines (drop in this order if the schedule slips)

1. Feedback dictation flash (lives in the written app instead)
2. Council grading (single model + flag)
3. Appeal flow beyond the chip + transcript link
4. Grid sorting/filtering niceties
5. The 5-second LMS montage (screens can be stills)

Never cut: the side-note card, the artifact panel diff moment, quote verification, the approve gates. Those four ARE the product.

## Working agreements

- Main stays green; small commits; verify before push.
- When a decision changes, the doc that records it changes in the same commit (ADRs for architecture, this plan for scope).
- No off-camera features, no speculative generality. Flexibility comes from the primitives being right, not from building extra surface.
