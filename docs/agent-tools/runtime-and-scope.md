# Runtime and scope contract

## Entry point

Professor conversation turns use `POST /api/atlas/planning`. The route accepts a thread id plus the current user message, limits the body to 64 KiB, limits user text to 4,000 characters, and rejects malformed or cross-course thread ids.

Only signed-in instructor-like users with an organization and a current teaching course may enter the runtime.

Proof: [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts).

## Server-owned scope

Every tool closes over:

```ts
{
  orgId: string;
  instructorId: string;
  courseId: string;
}
```

The model cannot supply or replace these fields. Current term and course come from `resolveScope` before model execution.

Proof: [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts), [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), and [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts).

## Limits

| Limit | Value |
| --- | ---: |
| Professor API body | 64 KiB |
| User turn | 4,000 characters |
| Professor thread | 400 persisted turns |
| Short-term rate | fewer than 30 user turns in 10 minutes per organization, user, course, and command surface |
| Route duration | 120 seconds |
| Model steps | 16 |
| Read result rows | generally 100 maximum |

Course material upload is a separate Course Setup server action. It accepts at most 25 MB and the framework buffers are capped at 26 MB including multipart overhead.

Proof: [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), [`lib/course/materials.ts`](../../lib/course/materials.ts), and [`next.config.mjs`](../../next.config.mjs).

## Per-turn sequence

1. Resolve authentication, organization, instructor, and course.
2. Resolve the institution model before creating a new thread.
3. Persist the professor's user turn.
4. Rebuild the current course context and active course agent configuration.
5. Load fixed reviewed `.atlas` agent and guardrail files.
6. Place current course data, course agent configuration, and compacted history in a lower-authority reference message immediately before the current request.
7. Run the nine-tool registry with a 16-step ceiling.
8. Persist the complete assistant response and tool parts.
9. Compact only after the assistant turn completes.

The active course agent configuration is fresh on every professor turn. `configure_agent` uses the version carried by that reference and rejects a stale write.

Proof: [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), and [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts).

## Student assessed-session sequence

1. Load the active typed course agent configuration and enforce its server-side turn limit before creating a turn.
2. Persist the student's turn before generation.
3. Evaluate deterministic personal-record note gates.
4. Rebuild published course context and ready, course-visible materials.
5. Compile fixed assessed-session rules first, then the assignment contract and course configuration.
6. Wrap course and material content as untrusted reference data.
7. Stream the response and persist assistant/tool parts.

Course configuration may shape name, voice, teaching approach, answer policy, challenge level, citations, turn limits, and scoped course rules. It cannot weaken fixed session rules, alter the rubric, add tools, or widen data access.

Proof: [`app/api/session/[assignmentId]/route.ts`](../../app/api/session/[assignmentId]/route.ts), [`lib/agent/session-runtime.ts`](../../lib/agent/session-runtime.ts), [`lib/agent/session-context.ts`](../../lib/agent/session-context.ts), and [`lib/agent/context.ts`](../../lib/agent/context.ts).

## Input and reference trust

`guardProfessorInput` performs request-level lexical role-confusion checks. It is not the authorization boundary.

User text, course text, material text, course agent configuration, prior turns, tool results, and loaded skills are reference data. Fixed application policy and scoped executors remain authoritative.

Proof: [`lib/agent/atlas-harness.ts`](../../lib/agent/atlas-harness.ts), [`.atlas/guardrails.md`](../../.atlas/guardrails.md), and [`lib/agent/professor-operator-context.ts`](../../lib/agent/professor-operator-context.ts).

## Visible execution state

The professor conversation shows only:

- transient thinking or task-specific working state;
- compact receipts for ordinary LMS writes;
- typed draft cards;
- actionable tool errors;
- the assistant's result, including confirmation of a course agent configuration change.

Completed reads and a completed run trace stay hidden. Teacher Settings shows the durable configuration record, version, disclosure, and provenance instead of raw prompt text or chain-of-thought.

Proof: [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx) and [`app/teach/settings/page.tsx`](../../app/teach/settings/page.tsx).
