# Course agent configuration

`configure_agent` is the only teacher-facing write path for shared course agent identity and teaching behavior.

## When to use it

Use this tool when the professor asks Atlas to change:

- agent name, role, or voice;
- teaching approach;
- Socratic default;
- direct-answer policy;
- challenge level;
- citation behavior;
- supported or avoided behavior;
- escalation conditions;
- a persistent study or AI-assignment rule;
- the student-facing disclosure.

## Request

```ts
{
  expectedVersion: number;
  changeSummary: string; // 3 to 240 characters
  studentDisclosure: string; // 20 to 600 characters
  configuration: {
    identity: {
      name: string; // 2 to 80 characters
      role: string; // 3 to 160 characters
      voice: string; // 3 to 400 characters
    };
    teaching: {
      approach: string; // 5 to 600 characters
      socraticByDefault: boolean;
      directAnswers: "never" | "after_attempt" | "when_asked";
      challengeLevel: "supportive" | "adaptive" | "rigorous";
      citationMode: "required" | "when_useful";
    };
    boundaries: {
      supports: string[]; // at most 12
      avoids: string[]; // at most 12
      escalatesWhen: string[]; // at most 12
    };
    rules: Array<{
      id: string; // stable kebab-case id
      title: string;
      instruction: string;
      appliesTo: Array<"study" | "assignment">;
      enabled: boolean;
    }>; // at most 24
  };
}
```

The request is a complete replacement. The model must copy every current value the professor did not ask to change from the fresh `agent_configuration` section of the professor context pack. Rate limits are server-owned and are not part of this tool or any course-actor surface.

## Execution

1. The Zod schema validates the complete configuration.
2. A lexical check rejects instruction-control language that tries to replace privileged prompts, disable authorization, or bypass guardrails.
3. A transaction takes an advisory lock for the organization and course.
4. The source Atlas chat is verified against organization, course, instructor, command surface, and course anchor.
5. The current highest version is compared with `expectedVersion`.
6. A mismatch aborts the write and tells Atlas to read the current state.
7. A successful write inserts one append-only `course_agent_configs` row at current version plus one.

The tool never updates or deletes an existing configuration row.

Proof: `writeCourseAgentConfig` in [`lib/agent/course-agent-config.ts`](../../lib/agent/course-agent-config.ts) and `courseAgentConfigurationTool` in [`lib/agent/course-agent-tool.ts`](../../lib/agent/course-agent-tool.ts).

## Return

Success:

```ts
{
  ok: true;
  action: "configure_agent";
  summary: string;
  record: {
    id: string;
    version: number;
    name: string;
    voice: string;
    rules: number;
    studentDisclosure: string;
    changeSummary: string;
  };
}
```

Failure:

```ts
{
  ok: false;
  error: string;
}
```

## Runtime propagation

The active row is the highest version for the course. Professor context includes it as lower-authority reference data. Student assessed sessions load it on every turn and compile it below fixed assessed-session rules and the assignment contract.

The configuration may shape teaching behavior. It cannot add tools, widen organization or course scope, expose credentials, or weaken grading and transcript constraints. External-source access is server-owned policy and is excluded from this model-visible complete-replacement contract, its reference block, and all course-actor settings.

The student session page shows the configured name, version, and student disclosure. It does not show raw prompts or hidden reasoning.

Proof: [`lib/agent/professor-context.ts`](../../lib/agent/professor-context.ts), [`lib/agent/session-runtime.ts`](../../lib/agent/session-runtime.ts), [`lib/agent/session-context.ts`](../../lib/agent/session-context.ts), and [`app/student/session/[assignmentId]/page.tsx`](../../app/student/session/[assignmentId]/page.tsx).
