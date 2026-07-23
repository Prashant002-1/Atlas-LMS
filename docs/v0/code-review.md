# Code Review: What Survives the Pivot

**Status:** historical pivot review, updated after Phase 0. Use this to understand why the old command/cue/Eve path was removed, not as a current task list.

**Method:** read-only review of the pre-v0 codebase: schema, agent core, AI provider code, routing, ADR-0008, fixture shape, and branch history. Judged against the v0 loop (configure -> session -> evidence -> class insight) and the five primitives (course record, session, rubric, policy/config, journey/evidence).

## TL;DR

Roughly **55-65% survived as KEEP or ADAPT - but what survived is plumbing and patterns, not the old product.** The strongest survivors are context packs, block registry discipline, apply-as-transaction, the provider registry, anchored sessions, proposal rows, and the route shell. **Verdict: v0 is a new grading-pipeline product wearing Atlas's plumbing.** Phase 0 has already discarded the old command/cue/Eve surfaces and old broad catalog.

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
| lib/ai/provider.ts | KEEP | The five-provider registry and server environment configuration are directly reusable. Organization credential storage is discarded; model infrastructure is platform-owned. |
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

1. **Live session engine** - the data contract exists, but the student session route and UI are not built yet.
2. **Artifact panel state** - typed fixture payloads exist; the live stream/write path still needs to produce them.
3. **Side-note cards** - typed fixture payloads exist; the live trigger path still needs to join student record, professor planning, current topic, and policy.
4. **Transcript grading pipeline** - evidence spans and journey reports exist in the demo world; the live pipeline still needs to produce them from submitted sessions.
5. **Professor journey views** - class rollups and reports exist as data; the professor drill-in/grid surfaces still need to render the live loop.
6. **Per-assignment policy** - current policy remains course-level plus v0 session-assignment config in the typed fixture. Decide in Phase 2 whether to add native rows immediately.

## Resolved in Phase 0

- Eve dependency, runtime mount, proxy route, bridge auth, runtime env split, session cursor columns, and public `/eve` allowlists were removed.
- Old command/cue UI and API surfaces were removed.
- ADR-0009 now supersedes ADR-0008.
- ADR index documents why ADR-0001 through ADR-0007 are not backfilled.
- Old multi-course fixture content was removed from the active seed.

## Still relevant

- **submissions PK is (assignmentId, userId)** - current submissions are useful for LMS state, but the live session transcript needs its own durable record path.
- **agentTurns.fts is a generated STORED column** over the parts jsonb; changing turn shape can degrade FTS recall unless the expression still fits.
- **compactIfNeeded swallows all errors** - if Phase 2 leans on compaction for long-session grounding, failures should become visible.
