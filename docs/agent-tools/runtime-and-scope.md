# Runtime and scope contract

## Entry point

Professor conversation turns use `POST /api/atlas/planning`. The route accepts a chat id plus the current user message, limits the body to 64 KiB, limits user text to 4,000 characters, and rejects malformed or cross-course chat ids.

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
| Professor chat | 400 persisted turns |
| Short-term rate | fewer than 30 user turns in 10 minutes per organization, user, course, and command surface |
| Route duration | 120 seconds |
| Model steps | 16 |
| Read result rows | generally 100 maximum |

Course material upload is a separate Materials server action. Personal student uploads use the same bounded ingestion seam and are attached only to the student's personal Atlas chat. Each upload accepts at most 25 MB and the framework buffers are capped at 26 MB including multipart overhead.

Proof: [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), [`lib/course/materials.ts`](../../lib/course/materials.ts), and [`next.config.mjs`](../../next.config.mjs).

## Per-turn sequence

1. Resolve authentication, organization, instructor, and course.
2. Resolve the Atlas platform model before creating a new chat.
3. Persist the professor's user turn and its scoped attachment ids.
4. Rebuild the current course context, active course agent configuration, professor memory, and ready chat-document context.
5. Load fixed reviewed `.atlas` agent and guardrail files.
6. Place current course data, course agent configuration, memory, bounded document content, and compacted history in a lower-authority reference message immediately before the current request.
7. Run the 29-tool base registry, plus `search_web` when policy and server credentials admit it, with a 16-step ceiling.
8. Persist the complete assistant response and tool parts.
9. Compact only after the assistant turn completes.

The active course agent configuration is fresh on every professor turn. `configure_agent` uses the version carried by that reference and rejects a stale write.

Proof: [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), and [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts).

## Student assessed-session sequence

1. Load the active typed course agent configuration and enforce the server-owned rate limit before creating a turn.
2. Persist the student's turn before generation.
3. Evaluate deterministic personal-record note gates.
4. Rebuild published course context and ready, course-visible materials.
5. Compile fixed assessed-session rules first, then the assignment contract and course configuration.
6. Wrap course and material content as untrusted reference data.
7. Stream the response and persist assistant/tool parts.

Course configuration may shape name, voice, teaching approach, answer policy, challenge level, citations, and scoped course rules. It cannot change rate limits, weaken fixed session rules, alter the rubric, add tools, or widen data access.

Proof: [`app/api/session/[assignmentId]/route.ts`](../../app/api/session/[assignmentId]/route.ts), [`lib/agent/session-runtime.ts`](../../lib/agent/session-runtime.ts), [`lib/agent/session-context.ts`](../../lib/agent/session-context.ts), and [`lib/agent/context.ts`](../../lib/agent/context.ts).

## Conditional public web search

`search_web` is server-owned and accepts one exact `query` object. The model cannot supply a URL, API key, provider option, result count, course selector, or arbitrary request body. It is omitted from the model-visible registry when the credential is absent or effective policy disables it. No product surface reports that configuration or availability.

Fixed platform boundaries are intersected with every applicable policy. University policy may disable search, lower the five-source cap, allow only named domains, or block domains. A course carries the same server-owned policy shape. Professor Atlas applies its current course policy. Assessed sessions apply university and course policy. The personal student Atlas applies university policy plus a named course's policy; cross-course or ambiguous requests apply every enrolled course policy so a restrictive course cannot be bypassed.

The tool sends one focused query to Exa's fixed HTTPS Search endpoint with `type: "auto"`, moderation enabled, the effective result bound, the effective domain constraints, and query-relevant highlights. Atlas validates and bounds the response, removes invalid or duplicate URLs, and returns source titles, URLs, optional dates and authors, and up to three excerpts per source. Prompts require Markdown-link citations for web-derived claims and treat all excerpts as untrusted reference data.

Missing credentials omit the tool. Provider errors, invalid responses, and rate limits collapse to an empty source set without response bodies, credentials, or provider plumbing. The runtime does not turn those states into configuration copy for course actors.

Proof: [`lib/agent/web-search.ts`](../../lib/agent/web-search.ts), [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), [`lib/agent/session-runtime.ts`](../../lib/agent/session-runtime.ts), and [`lib/agent/student-atlas-runtime.ts`](../../lib/agent/student-atlas-runtime.ts).

Provider contract: [Exa Search API](https://exa.ai/docs/reference/search).

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

Completed reads and a completed run trace stay hidden. Course setup shows the durable course-agent configuration, version, disclosure, and provenance. Instructor Settings describes the professor's own Atlas and its curated memory. Neither surface exposes raw prompt text, search infrastructure, or chain-of-thought.

Proof: [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx), [`app/teach/course/page.tsx`](../../app/teach/course/page.tsx), and [`app/teach/settings/page.tsx`](../../app/teach/settings/page.tsx).
