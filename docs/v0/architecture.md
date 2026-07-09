# v0 Architecture: Runtime and Grading Pipeline

**Status:** accepted and now largely implemented. Phase 0 removed Eve; Phase 2 chose turn-persisted streams over `WorkflowAgent` (ADR-0010); Phase 3 implemented pipeline steps 1-7 below (single-model per criterion, council deferred behind the judge seam, rollups deterministic with narration on top). Step 8, the calibration pilot, remains a live exercise before anyone calls the output a grade.

## 0. The shape being built

One loop on five primitives: professor configures a **session assignment** (agent-drafted rubric from syllabus + outcomes, professor edits and approves, policy toggles) -> student works a live **session** (streaming conversation + evolving typed artifact panel + margin side-note cards from the **course record**) -> a pipeline turns the transcript into **journey evidence** (per-criterion levels with verbatim quotes) -> professor reviews cards and class rollups. Requirements: typed structured streaming (blocks, not free text), sessions that survive a refresh, per-org BYOK, approval gates, Postgres as the record. Explicitly NOT needed: computer use, sandboxes, browsing, multi-agent swarms.

## 1. Runtime recommendation

**Recommendation: plain Vercel AI SDK 7 + `WorkflowAgent` (@ai-sdk/workflow) + typed data parts, with our own Postgres persistence.** Not Eve.

**Why not Eve:** Eve is the wrong shape for this v0. `defineAgent.model` remains static; `defineDynamic` covers tools/skills/instructions only, so per-org BYOK still requires either the Gateway `byok` escape hatch or a custom model proxy. The default harness is computer-use shaped, which is wrong for a typed-blocks session product. Eve's strengths are real, but not worth bringing back for this build. Sources: vercel.com/docs/eve; eve.dev/docs/agent-config; Eve release notes; Vercel changelog.

**Why the boring path stopped being hand-rolled:** AI SDK 7 includes `WorkflowAgent`, first-party durable, resumable agent steps, persistent streams via getWritable(), and tool approvals that survive restarts. Typed `data-*` parts and per-tool UI parts carry the artifact panel and side-note cards with explicit streaming states, so the React tree renders progressively without jank. Our own tables and typed payloads stay the source of truth, which the grading pipeline requires anyway.

**Accepted tradeoff:** we write our own session/turns schema and approval-gate logic instead of inheriting a framework's. More code up front, but code we can debug at 2am before the demo, on no one else's beta cadence. The code review confirms most of that schema already exists to adapt (agentSessions/agentTurns, changeProposals, apply.ts).

**Fallbacks if WorkflowAgent slows Phase 2 down:** Trigger.dev chat transport or Inngest step/wait patterns can cover durability only. Use a fallback only if it keeps the session engine moving.

**Skipped for this shape (one line each):** LangGraph.js (trails Python, verbose AI SDK glue); Mastra (good, but an orchestration layer we do not need yet); OpenAI Agents SDK (heading toward sandbox agents - wrong direction); Claude Agent SDK (computer-use harness by default, same wrong shape as Eve).

**Consequences for the repo:** the half-migrated Eve integration was removed in Phase 0 and ADR-0009 records the decision. Re-evaluate Eve only with a new ADR if it later fits the product shape.

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

## 3. Phase 2 decisions

1. Confirm whether `WorkflowAgent` is smooth enough for the session engine; otherwise use the simplest durable fallback.
2. Choose model selection per pipeline stage through the existing BYOK registry.
3. Decide whether the session agent and the grader share one context-pack builder or get separate builders. Default: shared builder with section flags.
