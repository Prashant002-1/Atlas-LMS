# Personal memory

The `remember` tool is the one write path for an agent's durable observations
about a person. The professor runtime and the student personal runtime share
it; each writes under its own profile (`professor` or `student`) for the
signed-in person only.

Implementation: [`lib/agent/memories.ts`](../../lib/agent/memories.ts).
Runtime registration: [`lib/agent/professor-runtime.ts`](../../lib/agent/professor-runtime.ts)
and [`lib/agent/student-atlas-runtime.ts`](../../lib/agent/student-atlas-runtime.ts).

## Request

| Field | Type | Rules |
| --- | --- | --- |
| `action` | `"add"` \| `"replace"` \| `"remove"` | Required. |
| `kind` | `"strength"` \| `"gap"` \| `"preference"` \| `"goal"` \| `"context"` | Optional; defaults to `context`. |
| `content` | string | Required for `add` and `replace`. One plain sentence, at most 240 characters. |
| `memoryId` | string | Required for `replace` and `remove`. The `m:` handle shown in the MEMORY block; a unique prefix of at least 4 characters resolves. |
| `courseId` | uuid | Optional course link. Must exist in the organization; the student profile also requires an active enrollment. |

## Behavior

- The active store is hard-capped in code: at most 40 entries and 2,200 total
  characters per person per profile. An over-budget `add` or `replace` returns
  a structured error telling the agent to consolidate first; the model cannot
  argue past the cap.
- Every entry is scanned for instruction-control language before acceptance,
  because memories are injected into future prompts as reference data. An
  entry that reads like a directive is rejected with a rewrite hint.
- An exact duplicate `add` is a quiet no-op ("Already noted.").
- `replace` and `remove` archive the previous row (`status = archived`,
  `archived_at`, `replaces_id`) instead of deleting, so every change keeps
  provenance, including the thread that made it (`source_session_id`).
- Results use the direct-action shape `{ ok, action: "remember", summary }`,
  so the rooms render a quiet receipt.

## Reads

There is no read tool. The active set is rendered into every turn's reference
data as the MEMORY block with a usage header and stable `m:` handles
(`renderMemoriesForReference`). The Settings page (professor) and the student
Profile page display the same rows.

## Storage

`agent_memories` in [`lib/db/schema.ts`](../../lib/db/schema.ts): organization,
user, authoring profile, kind, optional course, content, source session,
status, replacement provenance, timestamps. Migration
[`drizzle/0008_personal_agents.sql`](../../drizzle/0008_personal_agents.sql).
