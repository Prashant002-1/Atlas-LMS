# Atlas agent harness research

Date: 2026-07-14

## Question

What makes a strong modern agent harness, and which parts belong in a bounded professor agent inside an LMS?

## Product patterns

### Notion Agents

Notion separates the calm daily interaction from configuration and run history.

- The personal agent can occupy a full page, a right rail beside a page, or a floating window.
- Custom agents separate Chat, Activity, and Settings.
- Progress appears as compact operational rows such as creating, updating, or reading. Detail is disclosed when requested.
- The composer carries context, source, attachment, model, voice, send, and stop controls without filling the thread with explanatory copy.
- Outputs become native editable workspace objects rather than links to disposable chat text.
- Write-capable integrations require approval, while safe reads can run automatically.

Sources:

- https://www.notion.com/help/notion-agent
- https://www.notion.com/help/custom-agents
- https://www.notion.com/help/guides/get-started-with-your-personal-agent-in-notion
- https://www.notion.com/help/guides/build-your-first-custom-agent
- https://www.notion.com/help/custom-agents-security-features
- https://www.notion.com/help/notion-ai-app-for-ios

Implication for Atlas: the conversation should own the working viewport. Threads and drafts belong in an optional rail. Drafts render as the assignment, rubric, or course object they will become. Progress is operational, not a transcript of private reasoning.

## Authoring and runtime patterns

### OpenAI Codex

Codex uses separate layers for durable instructions, configuration, skills, external connections, and subagents.

- `AGENTS.md` carries small, persistent project guidance.
- `.codex/config.toml` supplies project configuration only for trusted projects.
- Skills use progressive disclosure: metadata is visible up front, while `SKILL.md` loads only when selected.
- Sandbox and approval policy are separate controls. A model cannot grant itself more authority.
- Managed requirements can prevent a project from overriding security-sensitive settings.

Sources:

- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/concepts/customization
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/config-basic
- https://developers.openai.com/codex/agent-approvals-security

Implication for Atlas: use a reviewed `.atlas` authoring layer, not a general coding runtime. Load only skill metadata on every turn and one small workflow body when needed. Keep provider keys, tenant scope, and action policy outside repository prompt files.

### OpenCode v2

OpenCode v2 treats an agent as a prompt, model preference, permissions, display metadata, and a session role.

- Primary and subagent modes are explicit.
- Permissions are ordered allow, ask, and deny rules.
- Hidden maintenance agents handle compaction, titles, and summaries.
- Project agent and skill files are discovered from a bounded directory structure.
- Sessions retain durable instruction updates and tool traces.
- The documentation warns that every enabled MCP server and tool consumes context.

Sources:

- https://v2.opencode.ai/agents
- https://v2.opencode.ai/instructions
- https://v2.opencode.ai/mcp-servers
- https://opencode.ai/docs/config/

Implication for Atlas: profile boundaries remain useful, but OpenCode's default build, shell, file, web, and subagent capabilities do not belong in the professor runtime. Atlas needs a small closed domain tool set and its existing Postgres sessions.

## Security patterns

### Convergent guidance

OWASP, OpenAI, Anthropic, and Vercel agree on the main architecture points:

- Treat user text, retrieved documents, tool results, memory, and remote content as untrusted.
- Never use model output as authorization.
- Scope each tool to the signed-in caller and tenant before the model sees it.
- Use structured tool inputs and outputs, validate parameters again in the executor, and limit result size.
- Separate reads from writes and require review for consequential changes.
- Put checks next to the tool that creates the side effect.
- Cap turns, steps, retries, bytes, and cost.
- Keep action traces, policy versions, and provenance.
- Do not expose hidden chain-of-thought. Show plans, tool calls, parameters, results, and short action summaries instead.
- Assume prompt injection cannot be solved by a stronger system prompt. Limit the blast radius if the model follows hostile text.

Sources:

- https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- https://developers.openai.com/api/docs/guides/agent-builder-safety
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- https://www.anthropic.com/engineering/claude-code-auto-mode
- https://vercel.com/blog/building-secure-ai-agents

## Atlas design derived from the research

### Interface

- Full-height conversation using all space left by the normal shell.
- Calm document-like assistant responses and compact user bubbles.
- Composer with voice placeholder, send, and real stop control.
- One collapsible run trace with the plan, context refresh time, and step outcomes.
- Individual tool rows with readable parameters and result summaries.
- Drafts rendered inline as assignments, rubrics, and course objects.
- Right rail closed by default, persistent, and limited to Threads and Drafts.
- No repeated gate narration and no ornamental name for the course.

### Runtime

- Current professor and course resolved from authentication on every request.
- User turn stored before generation.
- Current course snapshot rebuilt on every turn and inserted as lower-authority reference data immediately before the current request.
- Five tools only: inspect course, load workflow, draft AI assignment, draft rubric, and draft course objects.
- Scoped reads support domain, ids, search text, and result limits.
- Draft tools write only proposal rows. Review remains the apply path.
- `.atlas` paths are validated lexically and by real path, files are size capped, and skills are allowlisted by the manifest.
- Request body, turn length, thread length, model steps, and short-window traffic are capped.
- Duplicate AI assignment and rubric drafts are serialized per target with transaction-scoped advisory locks.
- Tool calls and results remain in the existing turn rows. No parallel trace table is needed.
- Agent Markdown cannot render HTML or make automatic remote image requests.

## Deliberate omissions

- No shell, filesystem mutation, arbitrary SQL, browser, web search, external MCP, email, grade write, publish, delete, or apply tool.
- No raw chain-of-thought.
- No new database tables.
- No general multi-agent router.
- No executable skill scripts.
- No claim that string matching defeats prompt injection. The security property is containment through scoped capabilities.
