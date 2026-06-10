# Atlas LMS — Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Ported from prototype |
| AI runtime | Vercel AI SDK v6 (`streamText`, typed tools, multi-step) | Ported |
| Models | Provider-abstracted; paid-capable defaults via env | **Fixed:** prototype shipped `:free` models with no SLA |
| DB | PostgreSQL 16 + pgvector | Atlas is the **source of truth** (read-write), not a Canvas mirror |
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

The agent never draws UI and never writes prose-as-product. It emits **typed blocks** — a closed, versioned zod registry (objective, module, assignment, page, announcement, practice_set, rubric, explanation, answer). Three consumers share the one schema:

1. the agent's tool inputs (what it is allowed to say),
2. the React component map (`components/agent/block-views.tsx`) used both for live streaming and for re-rendering persisted proposals,
3. the `proposal_blocks` rows (what gets applied to the course).

Professor surface: one command → one `change_proposal` → N blocks, each independently applicable. Student surface: one cue → exactly one response block, shaped by the course AI policy (depth, citations, persona, limits).

---

## The Alignment Graph (the new IP)

The tables that make Atlas more than a chat wrapper:

- `learning_objectives` — course/module objectives (with Bloom level), agent- or human-authored.
- `program_outcomes` — accreditation/program-level outcomes.
- `objective_outcome_map` — objectives → program outcomes (many-to-many).
- `content_alignments` — any content item (module, assignment, quiz, page, file) → objective, with weight.

From this graph we compute: student coverage vs. assessed weight, professor coverage gaps, and accreditation evidence — all as queries, not manual spreadsheets.

---

## Review-Based Authoring

Agent write tools append typed blocks to one pending `change_proposal` per run. Review renders the blocks through the component registry; applying writes the corresponding course rows in a single transaction (objectives first, so same-run alignments resolve), links `content_alignments`, and stamps each block with the record it created. Dismissing closes the proposal. There is no other path from agent output to live course state.

---

## Multi-tenancy & auth

- Every domain row carries `org_id`. Every tool resolves the tenant from the session and scopes its queries — no global reads (the prototype read the entire DB unscoped).
- Sessions are issued by Auth.js and carry `{ userId, orgId, role }`. `role ∈ {superadmin, admin, instructor, ta, student}`.
- `requireUser()` / `requireRole()` guard server actions, routes, and tools. Write tools additionally check the actor's role on the specific course (via `enrollments`).
- Memory and chat sessions are **per-user** (the prototype shared two hardcoded chat IDs across all visitors).

---

## Architecture Decision Records

**ADR-001 — Drizzle for schema & migrations.** The prototype ran `CREATE TABLE IF NOT EXISTS` / `ALTER` at request time. Products need versioned, reviewable migrations and typed queries. Drizzle keeps us close to SQL while giving both. _Trade-off:_ a build step; acceptable.

**ADR-002 — Auth.js over a managed vendor (e.g. Clerk).** Institutions will demand SAML/SSO and LTI; we need to own the auth layer and avoid per-seat vendor cost at university scale. _Trade-off:_ more code now; strategically necessary.

**ADR-003 — App-layer tenancy now, RLS later.** Per-row `org_id` + scoped queries ships fast and is debuggable. Postgres Row-Level Security is a hardening milestone before first paid institution.

**ADR-004 — 1536-dim embeddings.** The prototype used a 2048-dim model that _cannot_ be indexed by pgvector (ivfflat/hnsw cap at 2000 dims) and mismatched its own 1536 columns. We standardize on 1536 so content/memory vectors are HNSW-indexable from day one.

> These four are the biggest reversible-but-load-bearing choices. Flag early if you'd steer differently.
