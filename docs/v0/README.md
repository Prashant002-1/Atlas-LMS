# docs/v0 - Foundation Overview

**Status:** active v0 notes. Phases 0-4 are complete and merged. Phase 5 is demo readiness: live validation, on-camera polish, and recording. The demo's source of truth is `docs/demo/script.md`; the product thesis is `docs/Vision.md`.

v0 = the demo, built as a real product: one course wide, full-stack deep, running the loop **configure -> session -> evidence -> class insight** on the five primitives (course record, session, rubric, policy/config, journey/evidence). Seeded data is fine; faked behavior is not. Everything on camera runs.

| File | What it answers |
|---|---|
| `implementation-plan.md` | Current phase status, completed loop, deferred architecture, and demo-readiness work. |
| `data-blueprint.md` | The active demo-world data contract: one ECON-241 course, active mid-semester workload, full session transcripts, evidence, journey reports, and rollups. |
| `code-review.md` | Historical pivot review: what was kept, adapted, or discarded, plus what Phase 0 has already resolved. |
| `architecture.md` | Accepted runtime direction (AI SDK 7 + Postgres, with WorkflowAgent evaluated in Phase 2) and the transcript-grading pipeline design. |

The Phase 2 and Phase 3 door decisions are made: turn-persisted streams on plain AI SDK 7 (ADR-0010); "Work session" as the UI copy; native tables for every live object (sessions layer plus evidence_spans, journey_reports, class_rollups); single-model grading shipped with the council deferred behind the judgeCriterion seam; reports are drafts until the professor finalizes. Phase 4 closed the loop: the session cockpit, journey grid and drill-in with in-place evidence highlighting, finalize as the audited gradebook writer, class insight over stored rollups, and the practice-set proposal through the existing apply gate. Phase 5 owns live validation, demo-world polish, and recording. The professor-facing agent chat and its expanded AI SDK integration are intentionally deferred until their architecture is planned.
