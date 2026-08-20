# Course agent configuration and guidance

Atlas separates the course agent's cohesive teaching posture from addressable standing guidance. Both teacher-facing write paths create a proposal. Student behavior changes only when the professor applies that proposal.

## `configure_agent`

Use `configure_agent` for the shared name, role, voice, teaching approach, Socratic default, direct-answer policy, challenge level, citation behavior, boundaries, escalation conditions, and student-facing disclosure.

Request:

```ts
{
  expectedVersion: number;
  changeSummary: string;
  studentDisclosure: string;
  revisesProposalId?: string;
  configuration: {
    identity: { name: string; role: string; voice: string };
    teaching: {
      approach: string;
      socraticByDefault: boolean;
      directAnswers: "never" | "after_attempt" | "when_asked";
      challengeLevel: "supportive" | "adaptive" | "rigorous";
      citationMode: "required" | "when_useful";
    };
    boundaries: {
      supports: string[];
      avoids: string[];
      escalatesWhen: string[];
    };
  };
}
```

The model copies every current value the professor did not ask to change. The tool validates the expected version and stores a `course_agent_configuration` proposal block. Apply performs the append-only `course_agent_configs` write under the existing advisory lock and verifies the source Atlas chat. Prior configuration rows are never updated or deleted.

Success returns the proposal id, proposal revision, name, change summary, disclosure, voice, and approach. It does not claim the configuration is live.

## `inspect_course_guidance`

Use this bounded read before editing standing guidance. It accepts exact keys, namespace, text query, tags, disabled-state inclusion, and a limit. It returns the current revision, instruction, effect, selectors, structured value, and enabled state for each matching key.

This tool supports authoring and recall. Student enforcement does not depend on the model calling it.

## `propose_course_guidance`

Use this tool for one atomic set of standing guidance changes. Each directive contains:

```ts
{
  key: string; // stable namespaced key
  expectedRevision: number;
  title: string;
  instruction: string;
  effect: "guide" | "require" | "prohibit" | "escalate";
  valueJson?: string;
  valueSchema?: string;
  selectors: {
    audiences: string[];
    surfaces: string[];
    assignmentIds: string[];
    tags: string[];
  };
  enabled: boolean;
}
```

Keys and selector values are bounded open strings. The storage contract does not add a closed list of teaching or assessment categories. Applying appends one immutable `course_agent_directives` revision per key in the proposal transaction. A disabled revision is a tombstone.

## Revisions and in-chat decisions

Passing `revisesProposalId` creates an explicit next proposal revision and marks the prior open proposal Superseded in the same transaction. The chat renders compact Apply, Keep editing, Dismiss, and Details controls. Review remains the cross-chat inbox and history.

## Runtime propagation

The application loads the latest configuration version and latest directive revision for each key on every relevant turn. It selects directives by audience, surface, optional assignment id, and tags before generation, then compiles them below fixed application rules. Configuration and guidance cannot add tools, widen data scope, expose credentials, or weaken grading and transcript constraints. External-source access remains server-owned policy.

Proof: [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts), [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts), [`lib/agent/course-agent-directives.ts`](../../lib/agent/course-agent-directives.ts), [`lib/agent/apply.ts`](../../lib/agent/apply.ts), and [`components/planning/atlas-room.tsx`](../../components/planning/atlas-room.tsx).
