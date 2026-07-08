# ADR-0009: v0 Runtime: AI SDK 7, WorkflowAgent Path, Eve Removed

**Status:** Accepted  
**Supersedes:** ADR-0008  
**Date:** 2026-07-04

## Context

Atlas v0 is no longer the old command-and-cue LMS drafting product. The demo loop is configure -> session -> evidence -> class insight, with the session itself as the assessed work. That loop needs typed stream parts, durable student sessions, evidence-backed grading, approval gates, org-scoped model keys, and Postgres as the source of truth.

ADR-0008 adopted Eve for the previous agent layer. That choice no longer fits v0. The old integration added a second runtime, public `/eve` routing, session cursor columns, an `ATLAS_COMMAND_RUNTIME` split, and command-console behavior aimed at drafting LMS records. v0 needs a narrower session product, not completion of that branch.

## Decision

Atlas v0 uses stable AI SDK 7 as the runtime foundation. The durable-session path is `@ai-sdk/workflow` / WorkflowAgent if it proves ready for the v0 session engine; otherwise Phase 2 records the fallback decision and uses the simplest durable transport that satisfies refresh/resume and approval requirements.

Eve is removed from active code and configuration. Phase 0 deletes the package dependency, the mounted runtime bundle, `/api/agent/eve-command`, bridge auth, `/eve` middleware allowlists, the runtime selector env, and the Eve cursor fields on `agent_sessions`.

The reusable substrate stays: org BYOK, provider registry, context-pack discipline, `agent_sessions` / `agent_turns`, proposal rows, and the apply gate. Those pieces are adapted to the v0 primitives rather than discarded.

## Consequences

- There is one runtime path to reason about during the demo build.
- The app keeps control of persistence in Postgres, which the grading and evidence pipeline require.
- Workflow durability is adopted deliberately in Phase 2, not mixed into the old command surface.
- ADR-0008 remains as historical context but is no longer an implementation target.
- Any future Eve reconsideration requires a new ADR after it reaches the needs of this product: dynamic model resolution, typed session UI, and a stable API cadence.
