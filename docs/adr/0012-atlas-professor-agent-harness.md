# ADR-0012: Atlas professor agent harness

Date: 2026-07-14
Status: accepted
Relates to: ADR-0010, ADR-0011

## Context

The first professor chat proved the persistence and proposal path, but it presented a conventional chat card beside permanent panels. The runtime also placed a large course snapshot into every request and exposed four narrowly named tools without a reusable authoring layer. The result worked, but it did not yet feel or operate like a modern agent harness.

Research for this revision covered Notion Agents, OpenAI Codex configuration and skills, OpenCode v2 agents and permissions, OWASP agent security guidance, OpenAI agent safety guidance, Anthropic's action-classifier design, and Vercel's secure-agent guidance.

The convergent lessons are:

- The agent should occupy the workspace, not sit inside a card.
- Progress should be visible as operational steps and tool calls, while hidden chain-of-thought remains private.
- Tools should be few, domain-shaped, parameterized, scoped to the caller, and enforced by code.
- Rich workflows should load progressively instead of bloating every turn.
- Retrieved text is untrusted data. It must never become privileged instruction.
- A model is not an authorization layer. Writes require server checks and a separate apply path.

## Decision

### 1. A source-controlled `.atlas` authoring layer

The professor harness reads a validated `.atlas/manifest.json`. It loads `agent.md` and `guardrails.md` for every run, advertises only skill metadata, and loads a skill body on demand through `load_skill`.

Manifest paths must be relative, stay inside `.atlas`, and point to bounded text files. There is no dynamic plugin discovery, executable script loading, or user-editable prompt injection path. The standalone Next.js bundle explicitly includes `.atlas`.

### 2. Five bounded domain tools

The professor profile exposes exactly five tools:

- `inspect_course`: bounded current reads across named domains with optional identifiers, search text, and result limits.
- `load_skill`: loads one allowlisted workflow from the manifest.
- `draft_ai_assignment`: prepares one assignment contract and rubric.
- `draft_rubric`: prepares one rubric revision.
- `draft_course`: prepares up to six modules, assignments, pages, announcements, practice sets, or internal objective links.

There is no shell, filesystem, arbitrary SQL, browser, network fetch, general code execution, email, publishing, grading, deletion, or apply tool. Draft tools write only proposal rows, and Review remains the only apply door.

### 3. Fresh context with bounded reads

Every turn rebuilds a deterministic professor pack after the user's turn is durable and before generation begins. The pack includes its build time and token estimate. Tool reads query the database at execution time, reapply organization and course scope, limit their rows, and return an `asOf` timestamp.

The interface receives only context metadata, never hidden prompt text. This gives the professor a visible freshness receipt without duplicating course data in the UI or adding a new trace table. Tool calls and results already persist inside `agent_turns`, so the existing session rows remain the single trace store.

### 4. Guardrails are containment, not a promise

The route authenticates the instructor, resolves the current course, rejects malformed and explicit role-confusion inputs, enforces a database-backed request budget, validates thread ownership, and resolves the organization's model before generation.

The prompt separates fixed policy from delimited course data. Tool schemas and executors recheck authorization. External capabilities do not exist in the tool set. Model output is treated as untrusted UI data and rendered through the existing hardened Markdown path and typed draft cards.

This design does not claim prompt injection can be solved by prompting. It limits the consequence of a successful injection to bounded text generation and proposal creation inside the same professor and course scope.

### 5. Transparent traces, not raw reasoning

The harness shows:

- when the current course context was refreshed;
- a short plan derived from the run and tool sequence;
- every tool name, state, relevant parameters, and result summary;
- the draft object and its current Review status.

It does not request, persist, or display private chain-of-thought. This is both safer and more legible for professors. Operational evidence is the audit surface.

### 6. The Atlas page owns the available viewport

`/teach/atlas` removes the normal page container while mounted but does not lock or mutate the left sidebar. The harness grows and shrinks with the shell, so collapsing the sidebar immediately gives the conversation the full remaining viewport.

The supporting rail is closed by default, user-controlled, persistent, and collapsible. It contains threads and drafts only. The center remains the working conversation. Voice input is represented by a disabled microphone control with an honest future label.

## Consequences

- No database migration and no new dependency.
- The branch is stacked on PR #32 so the harness includes the latest shell and control-plane work.
- The existing Postgres turn persistence, BYOK resolver, proposal tables, apply gate, and compaction seam remain.
- `.atlas` can grow through reviewed, non-executable skills without expanding the runtime's authority.
- Public-link hardening now has a concrete test surface: prompt override, tool misuse, cross-tenant identifiers, rate limits, duplicate drafts, context poisoning, output rendering, and interrupted streams.

## Sources

- Notion Agent: https://www.notion.com/help/notion-agent
- Notion Custom Agents: https://www.notion.com/help/custom-agents
- OpenAI Codex customization: https://developers.openai.com/codex/concepts/customization
- OpenAI Codex skills: https://developers.openai.com/codex/skills
- OpenAI Codex security: https://developers.openai.com/codex/agent-approvals-security
- OpenCode v2 agents: https://v2.opencode.ai/agents
- OpenCode v2 instructions: https://v2.opencode.ai/instructions
- OWASP AI Agent Security: https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- OWASP Prompt Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- OpenAI agent safety: https://developers.openai.com/api/docs/guides/agent-builder-safety
- Anthropic auto mode: https://www.anthropic.com/engineering/claude-code-auto-mode
- Vercel secure agents: https://vercel.com/blog/building-secure-ai-agents
