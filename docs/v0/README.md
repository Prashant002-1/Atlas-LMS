# docs/v0 - Foundation Overview

**Status:** active v0 notes. Phase 0 is complete, Phase 1 is mostly complete, and Phase 2 is the next implementation phase. The demo's source of truth is `docs/demo/script.md`; the product thesis is `docs/Vision.md`.

v0 = the demo, built as a real product: one course wide, full-stack deep, running the loop **configure -> session -> evidence -> class insight** on the five primitives (course record, session, rubric, policy/config, journey/evidence). Seeded data is fine; faked behavior is not. Everything on camera runs.

| File | What it answers |
|---|---|
| `implementation-plan.md` | Current phase status: Phase 0 complete, Phase 1 mostly complete, Phase 2 next. |
| `data-blueprint.md` | The active demo-world data contract: one ECON-241 course, active mid-semester workload, full session transcripts, evidence, journey reports, and rollups. |
| `code-review.md` | Historical pivot review: what was kept, adapted, or discarded, plus what Phase 0 has already resolved. |
| `architecture.md` | Accepted runtime direction (AI SDK 7 + Postgres, with WorkflowAgent evaluated in Phase 2) and the transcript-grading pipeline design. |

Open decisions before Phase 2: durable session path, first UI copy for the assignment type, and whether live v0-only objects need native tables immediately or can start from the typed fixture contract.
