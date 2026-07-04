# Code Review: What Survives the Pivot

**Date:** 2026-07-04. **Method:** read-only review of main (~22 file reads: full schema, all of lib/agent and lib/ai core files, middleware, ADR-0008, fixtures shape, directory listings, branch/commit history). Judged against the v0 loop (configure -> session -> evidence -> class insight) and the five primitives (course record, session, rubric, policy/config, journey/evidence).

## TL;DR

Roughly **55-65% survives as KEEP or ADAPT - but what survives is plumbing and patterns, not product.** The strongest survivors (context packs, block registry, apply-as-transaction, BYOK, anchored sessions) are aimed at "professor drafts LMS content, student presses a cue button," not "student works a live problem and gets graded on the transcript." **Verdict: v0 is a new grading-pipeline product wearing Atlas's plumbing.** Keep the skeleton, discard essentially all block/route/UI content, build four new primitives on top. Note: main's HEAD is the pivot *docs* (d8009d7); the code is the old product. Docs are ahead of code by design.

## Inventory

| Area | Verdict | Reason |
|---|---|---|
| Tenancy: organizations, users, auth tables | KEEP | Multi-tenant substrate, orthogonal to the pivot |
| Academic core: terms, courses, enrollments, assignments | ADAPT | The course-record anchor survives; shrink the unused breadth (quizzes, calendarEvents, assignmentGroups, moduleItems) for a one-course v0 |
| submissions | DISCARD as-is | One row per (assignment, user) with scalar score/grade; no room for transcript, per-criterion scores, or evidence. The new shape is different in kind |
| Alignment Graph (learningObjectives, outcomes, alignments) | ADAPT | Demoted to substrate per the new Vision; outcome codes remain the rubric-drafting source |
| courseAiPolicies | ADAPT | Closest ancestor of the policy primitive, but per-COURSE and shaped for cue gating. v0 needs per-ASSIGNMENT policy with new toggles (grounding scope, transcript policy, side notes). Unique index on courseId alone confirms the gap |
| agentSessions / agentTurns | ADAPT | Nearly the session primitive already: anchored, persistent, FTS-indexed turns, compaction. Needs a session kind (professor planning vs student live) and artifact-state tracking |
| changeProposals / proposalBlocks | ADAPT | Propose-never-perform as rows is exactly right; every registered block type is course-authoring content. No session-assignment, artifact-state, grade, or journey blocks exist |
| cueEvents | DISCARD | Rate-limiting for cue buttons; the new loop has no cue buttons |
| chatSessions / chatMemories / plannerState | DISCARD | Legacy prototype chat, superseded by agentSessions/agentTurns per the schema's own comments |
| orgProviderKeys + lib/agent/keys.ts + lib/ai/provider.ts | KEEP | BYOK done properly (AES-256-GCM, org-scoped, 5 providers, env fallback). Directly reusable |
| lib/ai/embeddings.ts | KEEP | 1536-dim, L2-normalized, scoped to course-content lookup only. Reusable for grounding evidence against materials |
| lib/agent/blocks.ts | ADAPT | The registry pattern (one zod schema -> tool input + React render + persisted row) is the right contract for artifact panel, side notes, and journey cards. All 9 current block types get replaced |
| lib/agent/context.ts | ADAPT | Deterministic budgeted packs are right; needs new sections (session transcript, professor planning history, rubric) and loses the course-authoring focus |
| lib/agent/apply.ts | ADAPT | The single-transaction draft-to-live door survives as the approval mechanism; its switch only knows old block types (rubrics currently materialize as a Markdown page - a stopgap the code itself admits) |
| lib/agent/session.ts | ADAPT | Anchor + compaction + FTS recall reusable; wired to command/cue surfaces and conversation-length compaction, not artifact-bearing live sessions |
| components/agent/command-console.tsx (38KB) | DISCARD | The biggest sunk cost. A polished professor drafting surface for the old product; salvageable as UI-pattern reference only |
| components/agent/cue-panel.tsx, block-views.tsx | DISCARD | The exact surfaces the session replaces |
| components/ai-elements/* | KEEP | Generic conversation/message/tool primitives with no Atlas coupling; scaffolding for the new session surface |
| app/api/agent/{command,cue,eve-command} routes | DISCARD bodies, keep the streaming-route pattern | All three serve the old two-surface model |
| lib/db/fixtures | DISCARD content, KEEP discipline | Deterministic idempotent seeding is worth copying; the data itself is replaced per docs/v0/data-blueprint.md (13 students across 6 courses vs ~31 needed in one) |
| middleware.ts, auth | KEEP | Simple, cookie-gated, no public surface. Note the /eve path allowlists (see landmines) |
| Meridian design system | KEEP | Brand and tokens survive the rebuild |
| docs/adr/0008 (Eve adoption) | SUPERSEDE | Candid, but its whole frame is the old command/cue product. Needs a successor ADR once the runtime decision is made (see architecture.md) |

## Top gaps (exist in no form)

1. **Session assignment type** - no table, block kind, or route models it; changeProposals.kind enum has no variant for it.
2. **Artifact panel state** - nothing tracks an evolving structured object alongside a conversation; agentTurns.parts is a flat jsonb blob with no versioned artifact slot.
3. **Side-note cards** - no schema, block, or context section joins a student's record with the professor's planning sessions; context.ts has no professor-session-history section at all.
4. **Transcript grading pipeline** - no rubric-as-data, no per-criterion levels, no evidence spans. rubricBlockSchema exists but persists as a Markdown page.
5. **Journey/evidence objects and views** - no journey, evidence, or drill-in anywhere; courseGradeSnapshots is the nearest analog and carries no evidence payload.
6. **Class-insight aggregation** - class_state only counts submission statuses; no semantic aggregation over transcripts or criterion-level weakness clustering.
7. **Per-assignment AI policy** - confirmed absent.

## Landmines

- **Eve is live on main, not an experiment.** package.json pins eve ^0.11.7 and ai ^7.0.0-beta.178; agentSessions carries eveSessionId/eveContinuationToken/eveStreamIndex columns; an eve-command route and eve-auth.ts exist; feat/eve-agent-layer was already merged forward. There is a dual-runtime split behind ATLAS_COMMAND_RUNTIME=eve. Whatever the runtime decision, removal or completion is a real task, not a footnote.
- **middleware.ts allowlists /eve paths as public.** Removing Eve must remove these bypasses or they become dead attack surface.
- **submissions PK is (assignmentId, userId)** - no history/versioning; grading needs a first-class transcript entity to attach to, which does not exist.
- **agentTurns.fts is a generated STORED column** over the parts jsonb; restructuring turn shape silently degrades FTS recall unless the expression is updated.
- **compactIfNeeded swallows all errors** - if the new session leans on compaction for long-session grounding, failures are silent.
- **Known repo debt:** package-lock.json regeneration pending (npm registry blocked in some sandboxes); verify has not been run on recent commits; the last real code commits before the pivot were polish on the surface now being discarded - sunk cost to let go of deliberately.
- **ADR history:** only ADR-0008 exists as a file; ADR-0001..0007 are referenced by number but absent from docs/adr (their intent survives in PR bodies and Roadmap.md). Decide whether to backfill or renumber before writing the next ADR.
