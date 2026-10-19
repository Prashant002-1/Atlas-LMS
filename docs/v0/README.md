# docs/v0 - Foundation Overview

**Status:** v0 build notes. Phases 0-4 are complete and merged; Phase 5 covered live validation and polish. The product thesis is `docs/Vision.md`; the system overview is `docs/architecture.md`.

v0 = the demo, built as a real product: one course wide, full-stack deep, running the loop **configure -> session -> evidence -> class insight** on the five primitives (course record, session, rubric, policy/config, journey/evidence). Seeded data is fine; faked behavior is not. Everything shown in the demo runs for real.

| File | What it answers |
|---|---|
| `implementation-plan.md` | Current phase status, completed loop, deferred architecture, and demo-readiness work. |
| `econ241-seed-contract.md` | The seeded ECON-241 demo course: one course-sized record with modules, pages, materials, assignments, student work, and assessed sessions. |
| `architecture.md` | Accepted runtime direction (AI SDK 7 + Postgres, with WorkflowAgent evaluated in Phase 2) and the transcript-grading pipeline design. |

The Phase 2 and Phase 3 door decisions are made: turn-persisted streams on plain AI SDK 7 (ADR-0010); "Work session" as the UI copy; native tables for every live object (sessions layer plus evidence_spans, journey_reports, class_rollups); single-model grading shipped with the council deferred behind the judgeCriterion seam; reports are drafts until the professor finalizes. Phase 4 closed the loop: the session cockpit, journey grid and drill-in with in-place evidence highlighting, finalize as the audited gradebook writer, class insight over stored rollups, and the practice-set proposal through the existing apply gate. Phase 5 owns live validation, demo-world polish, and recording. The professor-facing agent chat and its expanded AI SDK integration are intentionally deferred until their architecture is planned.
