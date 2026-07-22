# ADR-0008: Adopt Vercel Eve for the agent layer

Status: Accepted, in rollout (2026-06-18)
Builds on: ADR-0005 (Postgres single source of truth), ADR-0006 (provider registry), ADR-0007 (embeddings for course-content only)

## Context

Atlas's agent layer is two thin Next.js route handlers (`app/api/agent/{command,cue}`) over the
Vercel AI SDK v6 (`streamText`/`generateText` + zod `tool()`), with Atlas owning everything around
the model in Postgres: deterministic context packs (`lib/agent/context.ts`), the versioned zod block
contract (`lib/agent/blocks.ts`), anchored sessions + turns + rolling compaction
(`lib/agent/session.ts`), Postgres-FTS session recall (`lib/agent/session-search.ts`), transactional
draft to live apply (`lib/agent/apply.ts`), and platform-owned model resolution
(`lib/ai/platform-model.ts`, `lib/ai/provider.ts`).

As of `eve@0.11.7`, Eve peers on `ai@7.0.0-beta.178`; Atlas has moved to that AI SDK beta and mounts
Eve through `withEve(nextConfig)`. The production command behavior has an Eve runtime path available
with `?runtime=eve` or `ATLAS_COMMAND_RUNTIME=eve`; the Atlas route backed by platform credentials
remains the default until the Eve model bridge is complete.

This works, but the session/runtime plumbing is hand-rolled: durability is best-effort, there is no
crash-safe resume, no parked work for human checkpoints, no first-class run history, schedules, or
observability. We want those without rebuilding them ourselves.

[Vercel Eve](https://vercel.com/eve) is a filesystem-first framework for durable backend agents,
built on the **same substrate Atlas already uses** (Vercel AI SDK + zod tools, AI Gateway resolves
AI SDK models, AI SDK spans). Adopting it is a runtime + authoring change, not a paradigm rewrite.

## Decision

Adopt Eve as the runtime for the whole agent layer. Author the agent as files under `agent/`
(`instructions.md`, `agent.ts`, `tools/`, `instructions/`, `channels/`, `lib/`), let Eve own the
durable session loop, and keep Atlas's invariants intact on top of it. The first landed steps are the
runtime mount, an Atlas agent root, a secured Eve HTTP channel, and an Eve command proxy that persists
Eve-emitted blocks back into Review.

### Stays (Atlas's edge, framework-agnostic)
- `lib/agent/blocks.ts` — the zod block contract becomes tool `inputSchema`/`outputSchema` and the
  client render contract. This is exactly where the industry is going (typed structured blocks
  rendered as cards: AI SDK data parts, Google A2UI, AG-UI). Unchanged.
- `lib/agent/context.ts` — deterministic, budgeted context packs. Eve does not replace this; it is
  called from a dynamic-instructions resolver. Unchanged.
- `lib/agent/apply.ts` + `dismissProposal` — transactional draft to live, pure Drizzle, invoked by
  Review out of band from the agent loop. Unchanged.
- `lib/ai/provider.ts` (registry still returns AI SDK `LanguageModel`s) and `lib/ai/embeddings.ts`.
- next-auth tenancy, reused inside an Eve `AuthFn`.

### Changes
- `app/api/agent/{command,cue}/route.ts` -> `agent/channels/{command,cue}.ts` via `defineChannel`.
  Tenant + role + policy gating + the cue daily limit move into the channel route handler.
- `lib/agent/runtime.ts` system prompts -> `agent/instructions/*` dynamic instructions built from
  the pack + policy, keyed on `ctx.session.auth`. The doctrine moves to `agent/instructions.md`.
- `lib/agent/runtime.ts` tools -> `agent/tools/*` (`defineTool` / `defineDynamic`), same zod block
  schemas. The "one proposal per run" accumulator moves to `defineState`.
- `lib/agent/session.ts` -> mostly replaced by Eve durable sessions + built-in compaction.
- `lib/agent/stream-client.ts` -> consume Eve's NDJSON event stream (`eve/client` /
  `useEveAgent`), rendering blocks from `actions.requested` / `action.result` (or `result.completed`
  for the single-block cue).

### Net-new we build
1. A **platform model adapter**: a `LanguageModel` configured from Atlas's server environment and
   shared by every course runtime. No request or organization context participates in model choice.
   Required because `defineAgent.model` is static. The adapter remains application infrastructure.
2. A channel `AuthFn` mapping the next-auth session to an Eve `SessionAuthContext`.
3. `disableTool()` for the default-harness tools (`bash`, `web_fetch`, `web_search`, `glob`, `grep`,
   `read_file`, `write_file`, `todo`, `load_skill`) to hold the grounded / propose-only doctrine.
   Eve defaults to an autonomous compute harness.
4. An optional `turn.completed` hook mirroring turns into Postgres `agent_turns` to keep the lean
   FTS recall tool and analytics.
5. A hosting decision for the Workflow world (Vercel Workflow, or self-host with `.workflow-data`
   on persistent storage).

### Net-new we gain
Crash-safe durable sessions + parked work, built-in human-in-the-loop approval (can gate
`applyProposal`), subagents, schedules (weekly digests, nightly struggle-signal rollups),
connections, Agent Runs observability, and an evals harness.

## Tensions and resolutions

1. **Platform model configuration vs static `defineAgent.model`.** Construct the model from Atlas's
   server environment at startup, using the existing provider registry or AI Gateway.
2. **ADR-0005 (Postgres single source) vs Eve Workflow-owned session state.** Revise ADR-0005:
   Postgres stays the source for the course record + proposals/blocks; conversation/runtime state
   moves to the Workflow world, optionally mirrored to Postgres for recall + analytics.
3. **Doctrine vs Eve default harness.** Lock down with `disableTool()` and tightly scoped dynamic
   tool sets; the cue surface exposes exactly one `emit*` tool.
4. **Domain-tuned compaction (preserve `[id:]`/codes) vs generic harness compaction.** Mitigate with
   short anchored sessions + FTS recall; no custom compaction prompt hook today.
5. **Self-host reality.** Vercel Workflow/Sandbox/Gateway are the out-of-the-box wins; self-hosting
   re-introduces a disk-persistent Workflow world and a sandbox backend we may not use.

## Consequences

- The session/runtime code we maintain shrinks; durability, observability, schedules, and HITL come
  from the framework.
- Eve is in beta; pin the version and watch `vercel/eve` for breaking changes before building deep.
- The first runtime mount and selectable Eve command path have landed on the PR branch. Eve can now
  emit Atlas proposal blocks that the app persists into Review. The default remains the Atlas route
  until platform model configuration is resolved in Eve.
- ADR-0005 must be amended (session state location). ADR-0006 stands: the provider registry now
  feeds the platform model adapter that Eve consumes.

## Rollout (phased)

- **Phase 0 — dependency/runtime mount:** installed Eve, moved Atlas to AI SDK 7 beta, wrapped Next
  with `withEve`, added the Atlas Eve agent root, disabled the unsafe default harness tools, and
  secured the Eve HTTP channel with Atlas bridge JWT auth.
- **Phase 1 — command surface bridge:** selectable Eve command runtime, Eve proposal tools, Atlas
  proxy route, durable Eve cursor on `agent_sessions`, and Review persistence for Eve-emitted blocks.
- **Phase 2 — cue surface:** cue surface as a custom channel, one `emit` tool, dynamic instructions
  from the pack, next-auth `AuthFn`, platform model adapter on one provider.
- **Phase 3 — command hardening:** platform model adapter, Eve-native inspect/recall tools,
  `turn.completed` Postgres mirror, and default the command center to Eve.
- **Phase 4 — harden:** Agent Runs/OTel, hosting decision, amend ADRs.
