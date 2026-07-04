# v0 Architecture: Runtime and Grading Pipeline

**Date:** 2026-07-04. **Status:** initial overview; recommendations to be ratified in the implementation session. Research current as of 2026-07-04 (sources dated inline).

## 0. The shape being built

One loop on five primitives: professor configures a **session assignment** (agent-drafted rubric from syllabus + outcomes, professor edits and approves, policy toggles) -> student works a live **session** (streaming conversation + evolving typed artifact panel + margin side-note cards from the **course record**) -> a pipeline turns the transcript into **journey evidence** (per-criterion levels with verbatim quotes) -> professor reviews cards and class rollups. Requirements: typed structured streaming (blocks, not free text), sessions that survive a refresh, per-org BYOK, approval gates, Postgres as the record. Explicitly NOT needed: computer use, sandboxes, browsing, multi-agent swarms.

## 1. Runtime recommendation

**Recommendation: plain Vercel AI SDK 7 + `WorkflowAgent` (@ai-sdk/workflow) + typed data parts, with our own Postgres persistence.** Not Eve, for now.

**Why not Eve (as of July 2026):** still beta with breaking changes shipping weekly (0.12.0 and 0.13.0 landed breaking changes in the last two weeks of June; docs state APIs "may change before general availability"). `defineAgent.model` remains static; `defineDynamic` covers tools/skills/instructions only, so per-org BYOK still requires either the Gateway `byok` escape hatch (couples us to Gateway routing) or a custom model proxy - ADR-0008 itself named this the biggest risk. The default harness remains computer-use shaped (bash/file/web tools to disable one by one), which is the wrong shape for a typed-blocks session product. Eve's genuine strengths (durability, HITL parking, channels, Agent Runs observability - Vercel built its own Vercel Agent on it, and shipped Agent Runs updates 2026-07-03) are not worth the churn for a three-week demo build. Sources: vercel.com/docs/eve; eve.dev/docs/agent-config; eve release notes 0.12.0/0.13.0 (June 2026); vercel.com/changelog 2026-07-03.

**Why the boring path stopped being hand-rolled:** AI SDK 7 shipped 2026-06-25 with `WorkflowAgent` - first-party durable, resumable agent steps ("use workflow" directive), persistent streams via getWritable(), and tool approvals that survive restarts, no Redis required (vercel.com/blog/ai-sdk-7). Typed `data-*` parts and per-tool UI parts (stable pattern since AI SDK 5) carry the artifact panel and side-note cards with explicit streaming states, so the React tree renders progressively without jank (ai-sdk.dev/docs/ai-sdk-ui/streaming-data). Our own tables (sessions, turns, artifact states, rubric, evidence) stay the source of truth - which the grading pipeline requires anyway (section 2).

**Accepted tradeoff:** we write our own session/turns schema and approval-gate logic instead of inheriting a framework's. More code up front, but code we can debug at 2am before the demo, on no one else's beta cadence. The code review confirms most of that schema already exists to adapt (agentSessions/agentTurns, changeProposals, apply.ts).

**Fallbacks if WorkflowAgent (one week old) proves too fresh:** Trigger.dev v4.5.0 (2026-07-02) shipped useTriggerChatTransport + chat.agent GA - a useChat conversation as a durable task surviving refresh/redeploy, approvals built in (trigger.dev/changelog/v4-5-0). Inngest's step.ai.wrap() + waitForSignal covers the same ground. Either is a credible drop-in for durability only.

**Skipped for this shape (one line each):** LangGraph.js (trails Python, verbose AI SDK glue); Mastra (good, but an orchestration layer we do not need yet); OpenAI Agents SDK (heading toward sandbox agents - wrong direction); Claude Agent SDK (computer-use harness by default, same wrong shape as Eve).

**Consequences for the repo:** the half-migrated Eve integration on main (eve dep, eve-command route, eve-auth.ts, eve columns on agentSessions, ATLAS_COMMAND_RUNTIME toggle, /eve middleware allowlists) gets removed, not completed. Re-evaluate Eve post-GA if it gains a dynamic model resolver and we want channels/schedules (professor notifications) later. ADR-0008 gets a successor recording this.

## 2. The grading pipeline ("the rubric reads the transcript")

This is the riskiest technical claim in the product: score a ~30-minute learning conversation per criterion, with verbatim evidence, reliably enough for grades. The research says it is achievable and says exactly where the traps are.

**Prior art.** Closest: NYU Stern's AI-conducted oral exam (Ipeirotis & Rizakos, arXiv:2603.18221, March 2026; viva.stern.nyu.edu) - their grading reliability jumped from alpha = 0.52 (single pass) to **Krippendorff's alpha = 0.86** using a three-model council with deliberation and a chair-model synthesis, rubric-anchored, and their grading prompt is public (gist.github.com/ipeirotis). Their stated lesson transfers verbatim: behavioral constraints must be enforced through architecture, not prompting. Also relevant: Stanford Tutor CoPilot's classifiers of tutoring moves (arXiv:2410.03017) and the talk-moves taxonomy literature (arXiv:2506.17410, arXiv:2603.05778) for criterion design; Mike Kentz's Comparative Transcript Analysis (Substack, 2024-2026) as the manual-practice baseline, with his warning that over-rigid rubrics punish legitimate conversational variety.

**Load-bearing findings.**
- **Never trust model-generated quotes.** Models asked to quote produce verbatim spans only ~18-28% of the time (QuoteVerify, Analemma Research, March 2026). Post-hoc span alignment against the source fixes this dramatically (FullCite, arXiv:2606.07130: snippet-F1 12.80 -> 61.87). Implication: evidence is stored as turn + character spans extracted and verified by string match, never as free text.
- **Decompose the rubric.** Per-criterion passes beat one-shot whole-rubric judging (rubric decomposition, Meta, arXiv:2602.05125, Feb 2026); rubric criteria also exhibit position bias when judged jointly (arXiv:2602.02219).
- **Known judge biases to design around:** position, verbosity, leniency drift; mitigations are structured outputs, fixed level descriptors, and calibration against a small human-labeled set.

**Recommended v0 pipeline (8 steps).**
1. Normalize the transcript: stable turn IDs, speaker roles, artifact-state snapshots interleaved.
2. Per-criterion evidence extraction: for each rubric criterion, extract candidate spans (turn + char offsets), student turns only by default.
3. **Quote verification:** string-match every span against the stored transcript; drop or re-extract failures. No unverified quote ever reaches a score or a UI.
4. Per-criterion level assignment: judge sees the criterion's level descriptors + verified evidence + minimal surrounding context; outputs level + rationale, structured.
5. Single strong model per criterion for v0 speed; **council (3 models + chair synthesis, NYU-style) only where stakes are high** - final submitted grades and appeals - not for drafts or practice.
6. Aggregate to the journey report (levels + weighted rollup + evidence refs).
7. Class rollup is **deterministic aggregation over stored scores** (counts, clusters), with an LLM narrating on top - never a fresh model pass inventing class statistics.
8. Calibration pilot: professor blind-grades 10-20 sessions with the same rubric; measure agreement (target the alpha = 0.86 benchmark) before anyone calls it a grade.

**Failure modes to design for.**
1. Decontextualized quotes - a verbatim span that misrepresents the exchange; keep surrounding turns available at judgment and in the drill-in UI.
2. **Agent-induced artifacts leaking into scores** - the pipeline must grade the STUDENT's moves, not the agent's scaffolding; a heavily-guided student is not an Exceeds. Speaker-scoped extraction (step 2) is the first defense; criterion descriptors should say it explicitly.
3. Rubric rigidity vs. transcript variability - legitimate sessions vary wildly in shape (Kentz's warning); level descriptors describe qualities of thinking, not required conversation shapes.

**Design implications for the schema:** evidence as (sessionId, turnId, charStart, charEnd); scores versioned with the rubric version that produced them; appeals attach to the same evidence objects; everything renderable in the drill-in view.

## 3. Open questions for the implementation session

1. Confirm WorkflowAgent maturity at build start (it is one week old); Trigger.dev is the tested fallback.
2. Eve removal scope and the successor ADR.
3. Model selection per pipeline stage (session agent vs extractor vs judge vs chair) through the existing BYOK registry.
4. Whether the session agent and the grader share one context-pack builder or get separate ones (lean: shared, with section flags).
