# docs/v0 - Foundation Overview

**Date:** 2026-07-04. **Status:** initial overview. Recommendations here are inputs to the implementation session, not final decisions. The demo's source of truth is `docs/demo/script.md`; the product thesis is `docs/Vision.md`.

v0 = the demo, built as a real product: one course wide, full-stack deep, running the loop **configure -> session -> evidence -> class insight** on the five primitives (course record, session, rubric, policy/config, journey/evidence). Seeded data is fine; faked behavior is not. Everything on camera runs.

| File | What it answers |
|---|---|
| `data-blueprint.md` | The shape, goals, and acceptance rules for the new demo-world dataset. A data-generation agent executes this; scenario is parameterized (econ placeholder until the final course is chosen). |
| `code-review.md` | What survives from the current implementation (keep / adapt / discard), the gaps v0 must build, and the landmines. Verdict: a new grading-pipeline product wearing Atlas's plumbing. |
| `architecture.md` | Runtime recommendation (AI SDK 7 + WorkflowAgent + own Postgres; Eve deferred) and the transcript-grading pipeline design with prior art and failure modes. |

Open decisions before build: final scenario (six criteria in `docs/demo/script.md` section 7), assignment-type naming (Session vs Tutorial), Eve removal scope, WorkflowAgent maturity re-check at build start.
