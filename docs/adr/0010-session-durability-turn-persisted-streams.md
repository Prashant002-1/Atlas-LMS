# ADR-0010: Session Durability via Turn-Persisted Streams

**Status:** Accepted
**Extends:** ADR-0009 (which deferred the durable-path decision to Phase 2)
**Date:** 2026-07-08

## Context

Phase 2 builds the live student session: a streaming tutor conversation with typed artifact updates and side-note cards, where a refresh must not lose the transcript and Submit must freeze a normalized record for grading. ADR-0009 committed to stable AI SDK 7 and said Phase 2 would either adopt `WorkflowAgent` (`@ai-sdk/workflow`) or record the fallback.

`WorkflowAgent` was evaluated against its current primary documentation (ai-sdk.dev, plus the Workflow DevKit docs it links out to):

- It requires the separate `workflow` runtime package (`'use workflow'` / `'use step'` compiler directives) and a "World" backend. The zero-config World is Vercel's managed one.
- Self-hosting means the Postgres World, which needs a **long-lived worker process polling the database**, explicitly not compatible with stock serverless Next.js, plus a separate `workflow build -t standalone` step and self-managed security for the `/.well-known/workflow/v1/*` handler endpoints.
- The one public report of exactly our combination (standalone Next.js in Docker against a remote Postgres) is an unresolved stuck-jobs issue (vercel/workflow#611).
- Its resumability transport (`WorkflowChatTransport`) and approval mechanism differ from the core SDK's, adding a second protocol to reason about during the demo build.

Atlas v0 runs self-hosted (Docker/local) on its own Postgres, and its actual durability requirement is narrow: a refresh mid-session must not lose the transcript, and the record must be queryable by the grading pipeline.

## Decision

The v0 session engine uses **plain AI SDK 7 with turn-persisted streams on Atlas's own Postgres**:

1. Every student turn is written to `agent_turns` BEFORE generation starts; it can never be lost.
2. The assistant turn streams over a `createUIMessageStream`; on end, its full parts (text, `update_artifact` tool calls, `data-side-note` parts) are written as one turn, and validated artifact updates are snapshotted to `session_artifact_states` at that turn index.
3. The session page hydrates the entire transcript from rows; the client sends only its latest message. A refresh replays the record; the only thing at risk mid-stream is the single reply being generated, which the student re-requests.
4. Submit freezes the session in one transaction: normalized transcript + final artifact into `session_submissions`, mirrored onto the classic gradebook row.

The seam is `lib/agent/session-runtime.ts` (`runSessionTurn`). Everything above it (route guards, policy, side-note trigger) and below it (session store, transcript normalizer) is runtime-agnostic. Adopting `WorkflowAgent` later replaces that one module and carries this ADR's successor.

`@ai-sdk/workflow` stays a pinned dependency: it is the evaluated path and the lockfile stays stable, but no active code imports it.

## Consequences

- One streaming protocol (UI message stream) and one persistence model (rows) to debug before the demo, on no external runtime's beta cadence.
- Mid-generation crash recovery and multi-day human-in-the-loop pauses are explicitly NOT provided; v0 does not need them. If a later phase does (long grading councils, professor approvals inside a stream), that is the trigger to re-evaluate `WorkflowAgent` with a new ADR.
- Approval safety for v0 stays where it already lives: `changeProposals` rows behind the transactional apply gate, out of band of any stream.
- No Redis and no `resumable-stream` infrastructure: mid-stream reconnect is traded away deliberately; refresh-resume comes from rows.
