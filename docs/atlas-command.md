# Atlas Command — the central agent surface

Atlas Command is the professor's home for working with the course's agent: the Codex / Claude Code
of an LMS, with the developer vocabulary abstracted away for educators. It replaces the single
"talking screen" (`components/agent/assistant.tsx`) with a three-region command center that shows
the agent thinking, streams its output, tracks every artifact it generates, and keeps a full
activity/audit trail. Interactive prototype: `docs/prototypes/atlas-command.html`.

## Why this shape (research-backed)

The strongest cross-product finding (Claude Code, OpenAI Codex, Cursor, Devin, Copilot Workspace;
plus practitioner discourse) is that **chat-first is the wrong abstraction for agents**. An agent
surface needs, beyond the thread: plan/▶progress visibility, intervention points, an artifact
ledger, and an audit trail — a different information architecture. LMS comparators (Canvas IgniteAI,
Khanmigo, Claude for Education, Coursera Coach) converge on one stance: **"AI drafts, the educator
publishes,"** grounded strictly to course material, with policy as settings (not config). Atlas
already embodies this in doctrine; Command exposes it.

Adopted patterns: progressive disclosure of reasoning (collapsed by default, not a chain-of-thought
dump); a timeline, not logs; typed structured blocks rendered as rich cards in our own design
system; the diff/review surface (not citations) is what earns operational trust; durable run ids
that outlive the tab; completion as a fired notification, not a polled state.

## Layout: three regions

1. **Left rail — Sessions.** New session (⌘N), search, sessions grouped by recency. Each row: status
   dot (running / done / idle), auto-titled from the opening intent, surface tag (Command / Cue),
   relative time. Sessions are per (user, course, surface, anchor), matching `lib/agent/session.ts`.
2. **Center — the working stream.** Session header (title, course, run state, ▶ Replay). The stream
   shows, per turn: the user intent; a **collapsible "Show Atlas's thinking" drawer** (status-iconed
   steps, collapsed once work starts); **action receipts** ("Inspected module · Week 7"); **block
   cards** rising in as they stream, each with Open in Review / Edit and a "drafted · not live" tag;
   a one-line narration; and the Review note. Composer at the bottom: command input, quick actions
   (Import syllabus / Draft this week / Write a note), and the standing reassurance line.
3. **Right rail — Artifacts + Activity.** The **Artifacts ledger**: every block this session
   produced with a status tag (drafted / applied / dismissed). The **Activity timeline**: the audit
   trail ("Drafted practice set · Hashing — just now", "Applied module · Week 12 — 2:17 PM") plus the
   provenance note ("drafted by Atlas, reviewed by you").

The student **Cue** surface is the same shell, narrowed: the three cue actions (Explain / Practice /
Ask) anchored to a record, a single grounded response block with citations, depth set by policy, and
a hard "ask your professor" escalation. No artifact ledger; a lightweight usage/struggle view for
the professor lives under Students.

## Mapping to Eve events (ADR-0008)

The stream renders Eve's NDJSON session events; blocks reuse `components/agent/block-views.tsx`
unchanged.

| Eve event | UI |
| --- | --- |
| `session.started` / `turn.started` | session appears/active; run state -> Working |
| `reasoning.appended` / `reasoning.completed` | thinking drawer steps (progressive disclosure) |
| `actions.requested` | action receipt card ("Atlas is …") |
| `action.result` | receipt resolves; if the tool emitted a block, the block card rises in + ledger entry + timeline log |
| `message.appended` / `message.completed` | narration line |
| `input.requested` | inline approval / clarification prompt at the point of output (HITL on the fault line) |
| `result.completed` | the cue's single response block |
| `turn.completed` / `session.waiting` | run state -> Idle; mirror turn to Postgres for recall |
| `compaction.requested/completed` | quiet "earlier turns summarized" marker |

Durable `sessionId` streams and reconnects (`?startIndex`); the `continuationToken` sends the next
turn. Closing the tab never loses the run.

## Build order

1. Shell: `components/agent/command/` — `command-center.tsx` (the 3-region layout), `session-rail.tsx`,
   `working-stream.tsx`, `thinking-drawer.tsx`, `action-receipt.tsx`, `artifact-ledger.tsx`,
   `activity-timeline.tsx`. Reuse `block-views.tsx` and `components/atlas/primitives.tsx`.
2. Wire to Eve's stream via `eve/client` (replacing `lib/agent/stream-client.ts`), behind a flag so
   the current assistant keeps working during the cutover.
3. Mount at `/teach/command` (Command) and reuse the shell for the student cue.

Design language is unchanged: the Observatory palette, Spectral serif headers, Hanken Grotesk body,
IBM Plex Mono labels, layered shadows, the 1px card lift.
