# docs/v0 - Foundation Overview

**Status:** active v0 notes. Phase 0 and Phase 1 are complete; Phase 2 (the session engine) is built and in review. The demo's source of truth is `docs/demo/script.md`; the product thesis is `docs/Vision.md`.

v0 = the demo, built as a real product: one course wide, full-stack deep, running the loop **configure -> session -> evidence -> class insight** on the five primitives (course record, session, rubric, policy/config, journey/evidence). Seeded data is fine; faked behavior is not. Everything on camera runs.

| File | What it answers |
|---|---|
| `implementation-plan.md` | Current phase status: Phase 0 complete, Phase 1 mostly complete, Phase 2 next. |
| `data-blueprint.md` | The active demo-world data contract: one ECON-241 course, active mid-semester workload, full session transcripts, evidence, journey reports, and rollups. |
| `code-review.md` | Historical pivot review: what was kept, adapted, or discarded, plus what Phase 0 has already resolved. |
| `architecture.md` | Accepted runtime direction (AI SDK 7 + Postgres, with WorkflowAgent evaluated in Phase 2) and the transcript-grading pipeline design. |

The Phase 2 door decisions are made: the durable session path is turn-persisted streams on plain AI SDK 7 (ADR-0010), the assignment type reads as "Work session" in UI copy, and the live v0 objects got native tables (rubrics, session_assignments, session_artifact_states, session_side_notes, session_submissions). Next open decisions belong to Phase 3: single-model grading first, council behind a flag.
