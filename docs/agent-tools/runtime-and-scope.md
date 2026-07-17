# Runtime and scope contract

This document describes the request path surrounding every professor-agent tool call.

## Entry point

The professor conversation sends `POST /api/atlas/planning`.

Accepted request body:

```ts
{
  sessionId?: "new" | "" | string; // existing value must be a UUID
  message?: {
    text?: string;
    parts?: Array<{ type?: string; text?: string }>;
  };
  text?: string; // fallback when no text is found in message
}
```

Text extraction order is:

1. top-level `text`, when it is a non-empty string;
2. `message.text`;
3. concatenated `message.parts` whose `type` is `text`.

Proof: `textFromIncoming` and `POST` in [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts).

## Authentication and roles

A request is accepted only when:

- the user is signed in;
- the user has an `orgId`;
- `isInstructorLike(user.role)` is true.

`isInstructorLike` means role rank is at least `instructor`. The accepted roles are:

- `instructor`
- `admin`
- `superadmin`

`ta` and `student` are rejected by this route.

Proof: `isInstructorLike` in [`lib/auth/session.ts`](../../lib/auth/session.ts) and `POST` in [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts).

## Current term and course selection

The route calls:

```ts
resolveScope({
  orgId: user.orgId,
  userId: user.id,
  role: user.role,
  teachingOnly: true,
})
```

Resolution order:

- term: `atlas-term` cookie, otherwise the term marked current, otherwise the first term ordered by newest start;
- course: explicit argument when supplied by a caller, otherwise `atlas-course` cookie, otherwise the first course ordered by code;
- `teachingOnly: true` keeps courses where the user's enrollment role is `instructor` or `ta`;
- admins and superadmins receive all courses in the organization and term, represented as instructor access.

The professor API does not accept a course id from the model or request body. It passes the course selected by `resolveScope` into every tool as `scope.courseId`.

Proof: `activeTerm`, `listCourses`, and `resolveScope` in [`lib/workspace/scope.ts`](../../lib/workspace/scope.ts).

## Scope object supplied to tools

Every tool receives server-resolved scope:

```ts
{
  orgId: string;
  instructorId: string;
  courseId: string;
}
```

The model does not provide these fields. Tool executors close over them when `professorOperatorTools` is created.

Proof: `ProfessorScope` in [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), and `professorOperatorTools({ scope, sessionId, model })` in [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts).

## Request and traffic limits

| Limit | Value | Enforcement |
| --- | ---: | --- |
| HTTP body | 64 KiB | `content-length` check plus encoded raw-body check |
| User text | 4,000 characters | route validation |
| Existing thread id | UUID, `new`, or empty | route validation |
| Thread length | 400 persisted turns | checked before model run |
| Short-term rate | fewer than 30 user turns in 10 minutes for the same org, user, course, command surface | database count over `agent_turns` and `agent_sessions` |
| Route duration | 120 seconds | `maxDuration` |
| Model steps per turn | 16 | `stopWhen: isStepCount(16)` |
| Tool read rows | generally 100 maximum; `inspect_lms` defaults to 30; `search_course` defaults to 8 per resource | Zod schemas in `lms-operator.ts` |

Proof: constants in [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts), and `runProfessorTurn` in [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts).

## Input preflight

`guardProfessorInput` rejects text matching four lexical groups:

- requests to ignore previous, prior, system, or developer instructions;
- requests to reveal or dump privileged prompts or instructions;
- requests to stop being Atlas;
- requests to become a coding, software, or general-purpose agent.

This is a request-level lexical check. It is separate from database scope enforcement.

Proof: `ROLE_CONFUSION_PATTERNS` and `guardProfessorInput` in [`lib/agent/atlas-harness.ts`](../../lib/agent/atlas-harness.ts).

## Model resolution

The route resolves the organization's configured model before it creates a new thread. If no model is configured, it returns HTTP 503 and does not create a thread.

Proof: `resolveModelForOrg` call order in [`app/api/atlas/planning/route.ts`](../../app/api/atlas/planning/route.ts).

## Conversation persistence

For each accepted turn:

1. Atlas titles the thread from the user's intent when needed.
2. The user turn is persisted before model generation.
3. The current professor context pack and `.atlas` harness are loaded.
4. The stored active turns are converted to model messages.
5. Current course data and any compacted thread summary are inserted as a lower-authority user reference immediately before the current request.
6. The model runs with the eight-tool registry and a 16-step ceiling.
7. The complete assistant response, including tool parts and results, is persisted.
8. Compaction runs after the completed assistant turn.

A new thread uses an `agent_sessions` row. User and assistant parts use `agent_turns` rows.

Proof: `runProfessorTurn` in [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts), plus session helpers in [`lib/agent/session.ts`](../../lib/agent/session.ts) and [`lib/agent/session-store.ts`](../../lib/agent/session-store.ts).

## Automatic context read before tools

Every turn rebuilds an instructor context pack before the model can call a tool. That pack reads:

- `courses`
- `terms`
- `course_ai_policies`
- `learning_objectives`
- `modules`
- `assignments`
- `pages`
- the five most recent `announcements`
- `content_alignments`
- `enrollments`
- `submissions`
- `session_assignments`
- `rubrics`
- pending `change_proposals`

Instructor context includes unpublished modules, assignments, and pages, with their state rendered in the reference data. The reference pack is bounded by section character limits in `buildProfessorPack`.

Proof: `buildContextPack` in [`lib/agent/context.ts`](../../lib/agent/context.ts) and `buildProfessorPack` in [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts).

## What the teacher sees during execution

The UI behavior is not another authority layer. It renders persisted stream parts as follows:

- while submitted with no assistant message: `Spinner` plus `Thinking`;
- while a tool is active: `Spinner` plus a task-specific label;
- completed read tools: hidden;
- successful direct action tool: one compact action receipt using its returned `summary`;
- draft tools: typed draft cards;
- tool errors: expanded tool error with parameters and error text;
- completed run trace: not rendered.

Proof: `PlanningMessageParts`, `ThinkingIndicator`, `ActionReceipt`, and `ToolError` in [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx).

## Scope guarantee and its exact boundary

All tools in the live registry receive `orgId` and `courseId` from the server. Their queries and mutations repeat those predicates on the target LMS tables. The grade and student tools additionally verify active enrollment for the current course.

The runtime does not expose:

- arbitrary SQL;
- a shell;
- filesystem mutation;
- network or web search;
- browser automation;
- general code execution;
- a user-selectable organization or course parameter inside a tool request.

Proof: the return value of `professorOperatorTools` in [`lib/agent/lms-operator.ts`](../../lib/agent/lms-operator.ts).
