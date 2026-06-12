# Atlas LMS, Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Ported from prototype |
| AI runtime | Vercel AI SDK v6 (`streamText`, typed tools, multi-step) | Ported |
| Models | Provider registry: openrouter, openai, anthropic, google, openai_compatible (opencode gateway) | Swap via env or BYOK; see ADR-006 |
| DB | PostgreSQL 16 + pgvector | Atlas is the **source of truth** (read-write), not a Canvas mirror |
| Retrieval | Session recall = keyword FTS (no LLM); semantic course-content = Gemini embeddings | Two separate paths; see ADR-005, ADR-007 |
| ORM / migrations | **Drizzle ORM** | **Fixed:** prototype created tables lazily at request time |
| Auth | **Auth.js (NextAuth v5)** + Drizzle adapter | **Fixed:** prototype had no auth at all |
| Tenancy | Shared DB, `org_id` on every domain row, app-layer scoping | RLS is a planned hardening step |
| UI | Tailwind v4, Radix, Framer Motion | Ported |

> Architecture Decision Records for the four "Fixed" items live at the bottom of this doc.

---

## System shape

```
                     ┌──────────────────────────────────────────────┐
  Browser  ─────────▶│  Next.js App Router (everything behind auth) │
  (student /         │   /                  role router             │
   instructor)       │   /student           study record + cues     │
                     │   /teach             teaching record         │
                     │   /teach/atlas       AI policy + BYOK keys   │
                     │   /api/agent/command professor surface (SSE) │
                     │   /api/agent/cue     student surface (SSE)   │
                     └───────────────┬──────────────────────────────┘
                                     │  session = { userId, orgId, role }
                     ┌───────────────▼──────────────────────────────┐
                     │  Agent runtime (lib/agent/)                   │
                     │   context.ts  deterministic course packs      │
                     │   session.ts  anchored sessions + compaction  │
                     │   blocks.ts   typed block registry (zod)      │
                     │   runtime.ts  surfaces, prompts, tools        │
                     │   apply.ts    proposal blocks → live records  │
                     │   keys.ts     BYOK (AES-GCM) + provider res.  │
                     └───────────────┬──────────────────────────────┘
                                     │
                     ┌───────────────▼──────────────────────────────┐
                     │  Postgres 16 + pgvector  (org-scoped)         │
                     │   Academic core · Terms · Alignment Graph ·   │
                     │   Proposals + blocks · Sessions/turns ·       │
                     │   Cue events · AI policy · Provider keys      │
                     └──────────────────────────────────────────────┘
```

---

## The generative-UI contract (`lib/agent/blocks.ts`)

The agent never draws UI and never writes prose-as-product. It emits **typed blocks**, a closed, versioned zod registry (objective, module, assignment, page, announcement, practice_set, rubric, explanation, answer). Three consumers share the one schema:

1. the agent's tool inputs (what it is allowed to say),
2. the React component map (`components/agent/block-views.tsx`) used both for live streaming and for re-rendering persisted proposals,
3. the `proposal_blocks` rows (what gets applied to the course).

Professor surface: one command → one `change_proposal` → N blocks, each independently applicable. Student surface: one cue → exactly one response block, shaped by the course AI policy (depth, citations, persona, limits).

---

## The Alignment Graph (the new IP)

The tables that make Atlas more than a chat wrapper:

- `learning_objectives`, course/module objectives (with Bloom level), agent- or human-authored.
- `program_outcomes`, accreditation/program-level outcomes.
- `objective_outcome_map`, objectives → program outcomes (many-to-many).
- `content_alignments`, any content item (module, assignment, quiz, page, file) → objective, with weight.

The graph exists to ground the agent and keep records aligned to intent. It is deliberately not surfaced as a score: no coverage percentages, no completion meters. Accreditation reporting can be derived from it later as queries.

---

## Review-Based Authoring

Agent write tools append typed blocks to one pending `change_proposal` per run. Review renders the blocks through the component registry; applying writes the corresponding course rows in a single transaction (objectives first, so same-run alignments resolve), links `content_alignments`, and stamps each block with the record it created. Dismissing closes the proposal. There is no other path from agent output to live course state.

---

## Multi-tenancy & auth

- Every domain row carries `org_id`. Every tool resolves the tenant from the session and scopes its queries, no global reads (the prototype read the entire DB unscoped).
- Sessions are issued by Auth.js and carry `{ userId, orgId, role }`. `role ∈ {superadmin, admin, instructor, ta, student}`.
- `requireUser()` / `requireRole()` guard server actions, routes, and tools. Write tools additionally check the actor's role on the specific course (via `enrollments`).
- Memory and chat sessions are **per-user** (the prototype shared two hardcoded chat IDs across all visitors).

---

## Architecture Decision Records

**ADR-001, Drizzle for schema & migrations.** The prototype ran `CREATE TABLE IF NOT EXISTS` / `ALTER` at request time. Products need versioned, reviewable migrations and typed queries. Drizzle keeps us close to SQL while giving both. _Trade-off:_ a build step; acceptable.

**ADR-002, Auth.js over a managed vendor (e.g. Clerk).** Institutions will demand SAML/SSO and LTI; we need to own the auth layer and avoid per-seat vendor cost at university scale. _Trade-off:_ more code now; strategically necessary.

**ADR-003, App-layer tenancy now, RLS later.** Per-row `org_id` + scoped queries ships fast and is debuggable. Postgres Row-Level Security is a hardening milestone before first paid institution.

**ADR-004, 1536-dim embeddings.** The prototype used a 2048-dim model that _cannot_ be indexed by pgvector (ivfflat/hnsw cap at 2000 dims) and mismatched its own 1536 columns. We standardize on 1536 so content/memory vectors are HNSW-indexable from day one.

**ADR-005, keyword FTS for session recall (not embeddings).** Recall over session history is a Postgres full-text path: a generated `tsvector` (`agent_turns.fts`) with a GIN index, matched by `websearch_to_tsquery`. A search returns a bounded view, the matching turns plus a ±N window and the conversation's opening/closing bookends, assembled in code and handed back as raw turns; the agent scrolls (`readHistoryWindow`) when it needs more. There is **no model call in the retrieval path**. This deliberately avoids the expensive shape (match → load whole session → format transcript → summarize with an LLM). Embeddings are explicitly _not_ used here: recall wants exact, cheap, deterministic, inspectable lookups. _Trade-off:_ keyword recall can miss pure paraphrase; acceptable, and far leaner than a vector index over chat. (Inspired by Hermes' SQLite-FTS5 `session_search`; realized on Postgres because Atlas is single-source-of-truth and adding a second datastore would not be lean.)

**ADR-006, a provider registry (chat/generation).** Models resolve through one registry (`lib/ai/provider.ts`) over openrouter, openai, anthropic, google, and an `openai_compatible` slot (configurable base URL, the intended path for opencode behind an OpenAI-compatible gateway, plus LiteLLM/vLLM/etc.). Selection is env-driven (`ATLAS_CHAT_PROVIDER`) with per-org BYOK overrides (`org_provider_keys`, now carrying `base_url`). opencode's native session API is agent-loop shaped (not an OpenAI-style completion) so it is **not** a drop-in `LanguageModel`; a thin, experimental native client lives in `lib/ai/opencode.ts` and stays off the default `streamText` path so Atlas keeps its own typed-block tools. _Trade-off:_ more provider packages; isolated behind one module.

**ADR-007, embeddings are for course content only.** Embeddings are reserved for semantic lookup over large content (the syllabus, long pages/files), never for session recall (see ADR-005). Default model is Google `gemini-embedding-002`, output truncated (MRL) to 1536 dims to fit the existing pgvector columns (ADR-004) and L2-normalized for stable cosine distance; short content is left in the deterministic context pack rather than embedded. _Trade-off:_ a managed embedding dependency, scoped to where semantics actually earn their cost.

> These are the biggest reversible-but-load-bearing choices. Flag early if you'd steer differently.
